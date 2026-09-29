import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.database.database import Base
from backend.database.models import Channel, ChannelSnapshot, PendingSyncChange
from backend.services.scoring import calculate_activity_score
from backend.services.sync_service import _subscriber_delta_pct


class ScoringTests(unittest.TestCase):
    def test_empty_uploads_are_inactive(self):
        score, label, breakdown = calculate_activity_score([])
        self.assertEqual(score, 0)
        self.assertEqual(label, "Aucune vidéo")
        self.assertEqual(sum(breakdown.values()), 0)

    def test_recent_regular_uploads_score_high(self):
        now = datetime.now(timezone.utc)
        uploads = [(now - timedelta(days=days)).isoformat() for days in (0, 4, 8, 12, 16, 20, 24, 28)]
        score, _label, _breakdown = calculate_activity_score(uploads, 2.0)
        self.assertGreaterEqual(score, 80)

    def test_subscriber_delta_percentage(self):
        self.assertIsNone(_subscriber_delta_pct(None, 100))
        self.assertIsNone(_subscriber_delta_pct(0, 100))
        self.assertAlmostEqual(_subscriber_delta_pct(100, 110) or 0, 10.0)


class AccountIsolationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(dbapi_connection, _record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_same_youtube_channel_can_exist_for_two_accounts(self):
        db = self.Session()
        try:
            db.add_all([
                Channel(account_id="account-a", id="UC123", name="Chaîne"),
                Channel(account_id="account-b", id="UC123", name="Chaîne"),
            ])
            db.commit()
            self.assertEqual(db.query(Channel).filter(Channel.id == "UC123").count(), 2)
        finally:
            db.close()

    def test_deleting_channel_cascades_its_snapshots(self):
        db = self.Session()
        try:
            channel = Channel(account_id="account-a", id="UC123", name="Chaîne")
            db.add(channel)
            db.flush()
            db.add(ChannelSnapshot(
                channel_pk=channel.pk,
                account_id="account-a",
                channel_id="UC123",
                captured_at=datetime.now(timezone.utc),
                subscribers=100,
                videos=10,
                score=80,
            ))
            db.commit()

            db.delete(channel)
            db.commit()
            self.assertEqual(db.query(ChannelSnapshot).count(), 0)
        finally:
            db.close()

    def test_pending_removals_are_isolated_per_account(self):
        db = self.Session()
        try:
            db.add_all([
                PendingSyncChange(account_id="account-a", removed=2),
                PendingSyncChange(account_id="account-b", removed=1),
            ])
            db.commit()

            self.assertEqual(db.get(PendingSyncChange, "account-a").removed, 2)
            self.assertEqual(db.get(PendingSyncChange, "account-b").removed, 1)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
