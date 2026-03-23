-- Add ShotDetails JSON column for contextual per-category details
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FactShots') AND name = 'ShotDetails')
  ALTER TABLE FactShots ADD ShotDetails NVARCHAR(MAX) NULL;
