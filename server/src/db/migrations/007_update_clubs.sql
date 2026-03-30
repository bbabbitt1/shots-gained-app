-- Replace 50° with 52° and 58° with 60° in FactShots
UPDATE FactShots SET ClubUsed = '52°' WHERE ClubUsed = '50°';
UPDATE FactShots SET ClubUsed = '60°' WHERE ClubUsed = '58°';
