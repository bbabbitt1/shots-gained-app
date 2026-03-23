-- DimPlayer
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DimPlayer')
CREATE TABLE DimPlayer (
  PlayerID INT IDENTITY(1,1) PRIMARY KEY,
  PlayerName NVARCHAR(100) NOT NULL,
  Email NVARCHAR(255) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(255) NOT NULL,
  CreatedDate DATETIME2 DEFAULT GETDATE()
);

-- DimAvg (benchmark data)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DimAvg')
CREATE TABLE DimAvg (
  Surface NVARCHAR(20) NOT NULL,
  Distance INT NOT NULL,
  TourAvg FLOAT NOT NULL,
  UnitOfMeasurement NVARCHAR(10) DEFAULT 'Yds',
  PRIMARY KEY (Surface, Distance)
);

-- DimCourse
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DimCourse')
CREATE TABLE DimCourse (
  CourseID INT IDENTITY(1,1) PRIMARY KEY,
  ClubName NVARCHAR(200) NOT NULL,
  CourseName NVARCHAR(200) NOT NULL,
  APISourceID NVARCHAR(100),
  CreatedDate DATETIME2 DEFAULT GETDATE()
);

-- DimCourseHoles
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DimCourseHoles')
CREATE TABLE DimCourseHoles (
  CourseID INT NOT NULL FOREIGN KEY REFERENCES DimCourse(CourseID),
  HoleNumber INT NOT NULL,
  Par INT NOT NULL,
  Yardage INT NOT NULL,
  Tee NVARCHAR(50) NOT NULL,
  PRIMARY KEY (CourseID, HoleNumber, Tee)
);

-- DimRound
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DimRound')
CREATE TABLE DimRound (
  RoundID INT IDENTITY(1,1) PRIMARY KEY,
  PlayerID INT NOT NULL FOREIGN KEY REFERENCES DimPlayer(PlayerID),
  CourseID INT FOREIGN KEY REFERENCES DimCourse(CourseID),
  RoundDate DATE NOT NULL,
  HolesPlayed INT NOT NULL,
  TeePreference NVARCHAR(50),
  Benchmark NVARCHAR(20) DEFAULT 'Pro',
  CreatedDate DATETIME2 DEFAULT GETDATE()
);

-- FactShots
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FactShots')
CREATE TABLE FactShots (
  ShotID INT IDENTITY(1,1) PRIMARY KEY,
  PlayerID INT NOT NULL FOREIGN KEY REFERENCES DimPlayer(PlayerID),
  RoundID INT NOT NULL FOREIGN KEY REFERENCES DimRound(RoundID),
  Hole INT NOT NULL,
  Par INT NOT NULL,
  HoleResult NVARCHAR(20),
  Category NVARCHAR(20) NOT NULL,
  SurfaceStart NVARCHAR(20) NOT NULL,
  DistanceStart FLOAT NOT NULL,
  SurfaceEnd NVARCHAR(20) NOT NULL,
  DistanceEnd FLOAT NOT NULL,
  ClubUsed NVARCHAR(50),
  ShotShape NVARCHAR(50),
  Penalty BIT DEFAULT 0,
  StrokesGained FLOAT NOT NULL
);
