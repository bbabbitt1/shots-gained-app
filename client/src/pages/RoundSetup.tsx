import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCourses, getCourseDetails } from '../services/api';

interface CourseResult {
  id: string;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string };
}

interface TeeOption {
  tee_name: string;
  total_yards: number;
  par_total: number;
  holes: { holeNumber: number; par: number; yardage: number }[];
}

const RoundSetup = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CourseResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedCourse, setSelectedCourse] = useState<CourseResult | null>(null);
  const [tees, setTees] = useState<TeeOption[]>([]);
  const [selectedTee, setSelectedTee] = useState('');
  const [loadingTees, setLoadingTees] = useState(false);

  const [customYardages, setCustomYardages] = useState<number[] | null>(null);
  const [holesPlayed, setHolesPlayed] = useState('18');
  const [roundDate, setRoundDate] = useState(new Date().toISOString().split('T')[0]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 3 || selectedCourse) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const data = await searchCourses(searchQuery);
        const courses = data.courses || [];
        setSearchResults(courses);
        setShowDropdown(courses.length > 0);
        if (courses.length === 0) setSearchError('No courses found');
      } catch (err) {
        setSearchResults([]);
        setShowDropdown(false);
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCourse]);

  // Fetch tee details after selecting a course
  const selectCourse = async (course: CourseResult) => {
    setSelectedCourse(course);
    setSearchQuery(course.club_name || '');
    setShowDropdown(false);
    setSearchResults([]);
    setLoadingTees(true);

    try {
      const details = await getCourseDetails(course.id);
      const courseData = details.course || details;
      const teeOptions: TeeOption[] = [];

      if (courseData.tees) {
        const allTees = [
          ...(courseData.tees.male || []),
          ...(courseData.tees.female || []),
        ];
        for (const tee of allTees) {
          if (teeOptions.some((t) => t.tee_name === tee.tee_name)) continue;
          const holes = (tee.holes || []).map((h: { par: number; yardage: number }, i: number) => ({
            holeNumber: i + 1,
            par: h.par,
            yardage: h.yardage,
          }));
          teeOptions.push({
            tee_name: tee.tee_name,
            total_yards: tee.total_yards || holes.reduce((s: number, h: { yardage: number }) => s + h.yardage, 0),
            par_total: tee.par_total || holes.reduce((s: number, h: { par: number }) => s + h.par, 0),
            holes,
          });
        }
      }

      setTees(teeOptions);
      if (teeOptions.length > 0) setSelectedTee(teeOptions[0].tee_name);
    } catch {
      setTees([]);
    } finally {
      setLoadingTees(false);
    }
  };

  const clearCourse = () => {
    setSelectedCourse(null);
    setSearchQuery('');
    setTees([]);
    setSelectedTee('');
    setCustomYardages(null);
  };

  const handleStart = () => {
    const teeData = tees.find((t) => t.tee_name === selectedTee);
    const holes = (teeData?.holes || []).map((h, i) => ({
      ...h,
      yardage: customYardages ? (customYardages[i] || h.yardage) : h.yardage,
    }));

    sessionStorage.setItem('roundSetup', JSON.stringify({
      course: {
        clubName: selectedCourse?.club_name || searchQuery,
        courseName: selectedCourse?.course_name || '',
        apiSourceId: selectedCourse?.id,
      },
      tee: customYardages ? 'Custom' : selectedTee,
      holes,
      holesPlayed: parseInt(holesPlayed),
      roundDate,
    }));

    navigate('/round/play');
  };

  const activeTee = tees.find((t) => t.tee_name === selectedTee);

  return (
    <div className="min-h-dvh px-4 pt-6 pb-10 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Round Setup</h1>

      <div className="space-y-5">
        {/* Course Search */}
        <div className="relative" ref={dropdownRef}>
          <label className="text-text-secondary text-xs mb-1 block">Course</label>
          {selectedCourse ? (
            <div className="flex items-center justify-between bg-bg-surface border border-accent/50 rounded-lg px-4 py-3">
              <div>
                <div className="text-text-primary font-medium">{selectedCourse.club_name}</div>
                {selectedCourse.location && (
                  <div className="text-text-muted text-xs">
                    {selectedCourse.location.city}, {selectedCourse.location.state}
                  </div>
                )}
              </div>
              <button onClick={clearCourse} className="text-text-muted hover:text-sg-negative text-sm px-2">
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search golf courses..."
                className="w-full"
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              />
              {searching && (
                <div className="text-text-muted text-xs mt-1 flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
                  Searching...
                </div>
              )}
              {searchError && !searching && (
                <p className="text-sg-negative text-xs mt-1">{searchError}</p>
              )}
            </>
          )}

          {/* Search Results Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-bg-surface border border-border rounded-lg max-h-64 overflow-y-auto shadow-lg shadow-black/30">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCourse(c)}
                  className="w-full text-left px-4 py-3 hover:bg-accent/10 active:bg-accent/20 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="text-text-primary text-sm font-medium">{c.club_name}</div>
                  <div className="text-text-muted text-xs">
                    {c.course_name}
                    {c.location && ` — ${c.location.city}, ${c.location.state}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tee Selection */}
        {loadingTees && (
          <div className="text-text-muted text-sm flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
            Loading tees...
          </div>
        )}

        {tees.length > 0 && (
          <div>
            <label className="text-text-secondary text-xs mb-2 block">Select Tees</label>
            <div className="space-y-2">
              {tees.map((t) => (
                <button
                  key={t.tee_name}
                  onClick={() => { setSelectedTee(t.tee_name); setCustomYardages(null); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                    selectedTee === t.tee_name && !customYardages
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-text-muted'
                  }`}
                >
                  <span className={`font-medium ${selectedTee === t.tee_name && !customYardages ? 'text-accent' : 'text-text-primary'}`}>
                    {t.tee_name}
                  </span>
                  <span className="text-text-muted text-sm">
                    {t.total_yards.toLocaleString()} yds · Par {t.par_total}
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  const base = activeTee || tees[0];
                  if (base) {
                    setCustomYardages(base.holes.map((h) => h.yardage));
                    setSelectedTee(base.tee_name);
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  customYardages
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-text-muted'
                }`}
              >
                <span className={`font-medium ${customYardages ? 'text-accent' : 'text-text-primary'}`}>
                  Custom
                </span>
                <span className="text-text-muted text-sm">Edit yardages</span>
              </button>
            </div>
          </div>
        )}

        {/* Hole-by-hole preview / edit */}
        {activeTee && activeTee.holes.length > 0 && (
          <div className="bg-bg-card border border-border rounded-xl p-3 overflow-x-auto">
            <div className="text-text-secondary text-xs font-medium mb-2 uppercase tracking-wider">
              {customYardages ? 'Custom' : activeTee.tee_name} Tees — Hole Details
            </div>
            {[0, 9].map((start) => {
              const slice = activeTee.holes.slice(start, start + 9);
              if (slice.length === 0) return null;
              return (
                <div key={start} className={start > 0 ? 'mt-3 pt-3 border-t border-border/50' : ''}>
                  <div className="grid gap-1 text-center text-xs min-w-0" style={{ gridTemplateColumns: `32px repeat(${slice.length}, minmax(28px, 1fr))` }}>
                    <div className="text-text-muted text-left">Hole</div>
                    {slice.map((h) => (
                      <div key={h.holeNumber} className="text-text-muted">{h.holeNumber}</div>
                    ))}
                    <div className="text-text-muted text-left">Yds</div>
                    {slice.map((h, i) => (
                      <div key={h.holeNumber}>
                        {customYardages ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            value={customYardages[start + i] || ''}
                            onChange={(e) => {
                              const updated = [...customYardages];
                              updated[start + i] = Number(e.target.value);
                              setCustomYardages(updated);
                            }}
                            className="w-full text-center text-xs !px-0 !py-0.5 !rounded-md !border-border/50"
                          />
                        ) : (
                          <div className="text-text-primary font-medium">{h.yardage}</div>
                        )}
                      </div>
                    ))}
                    <div className="text-text-muted text-left">Par</div>
                    {slice.map((h) => (
                      <div key={h.holeNumber} className="text-text-muted">{h.par}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Holes */}
        <div>
          <label className="text-text-secondary text-xs mb-2 block">Holes</label>
          <div className="grid grid-cols-3 gap-2">
            {['9', '18', 'other'].map((opt) => (
              <button
                key={opt}
                onClick={() => setHolesPlayed(opt === 'other' ? '' : opt)}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  holesPlayed === opt || (opt === 'other' && !['9', '18'].includes(holesPlayed))
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-secondary hover:border-text-muted'
                }`}
              >
                {opt === 'other' ? 'Other' : opt}
              </button>
            ))}
          </div>
          {!['9', '18'].includes(holesPlayed) && (
            <input
              type="number"
              inputMode="numeric"
              value={holesPlayed}
              onChange={(e) => setHolesPlayed(e.target.value)}
              placeholder="Number of holes"
              className="w-full mt-2 text-sm"
              min={1}
              max={18}
            />
          )}
        </div>

        {/* Date */}
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Date</label>
          <input
            type="date"
            value={roundDate}
            onChange={(e) => setRoundDate(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Start Round */}
        <button
          onClick={handleStart}
          disabled={!searchQuery || !holesPlayed}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-4 rounded-xl transition-colors text-lg mt-2"
        >
          Start Round
        </button>
      </div>
    </div>
  );
};

export default RoundSetup;
