-- Add ShotResult column to FactShots for contextual shot outcomes
-- (Fairway Result, GIR, Miss Direction, Layup, etc.)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FactShots') AND name = 'ShotResult')
  ALTER TABLE FactShots ADD ShotResult NVARCHAR(20) NULL;
