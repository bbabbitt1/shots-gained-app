-- Composite indexes for common query patterns

-- Player rounds lookup (ordered by date)
CREATE NONCLUSTERED INDEX IX_DimRound_PlayerID_RoundDate
ON DimRound (PlayerID, RoundDate DESC);

-- Shots by round + player
CREATE NONCLUSTERED INDEX IX_FactShots_RoundID_PlayerID
ON FactShots (RoundID, PlayerID);

-- Hole scores by round
CREATE NONCLUSTERED INDEX IX_FactHoleScores_RoundID
ON FactHoleScores (RoundID);

-- Course API dedup
CREATE NONCLUSTERED INDEX IX_DimCourse_APISourceID
ON DimCourse (APISourceID) WHERE APISourceID IS NOT NULL;

-- Benchmark lookup by surface + distance
CREATE NONCLUSTERED INDEX IX_DimAvg_Surface_Distance
ON DimAvg (Surface, Distance) INCLUDE (TourAvg);
