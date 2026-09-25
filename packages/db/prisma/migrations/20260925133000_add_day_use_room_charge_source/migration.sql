-- Keep same-day checkout accommodation revenue distinct from nightly room charges.
ALTER TYPE "FolioItemSource" ADD VALUE IF NOT EXISTS 'DAY_USE_ROOM_CHARGE';
