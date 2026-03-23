import { useState, useEffect, useMemo } from 'react';
import type { Shot, Surface, EndSurface, Category, BenchmarkRow, ShotDetails } from '@shared/types';
import { SURFACES, END_SURFACES, CATEGORIES, CLUBS } from '@shared/types';
import { calculateStrokesGained, inferCategory, formatSG, getShotResultContext, autoShotResult } from '@shared/sg-calculator';
import ShotDetailsPanel from './ShotDetailsPanel';

interface ShotFormProps {
  hole: number;
  par: number;
  shotNumber: number;
  benchmarks: BenchmarkRow[];
  previousShot: Shot | null;
  holeYardage?: number;
  onAddShot: (shot: Shot) => void;
  playerId: number;
}

const ShotForm = ({ hole, par, shotNumber, benchmarks, previousShot, holeYardage, onAddShot, playerId }: ShotFormProps) => {
  const defaultSurfaceStart: Surface = previousShot
    ? (previousShot.surfaceEnd === 'Hole' ? 'Tee' : previousShot.surfaceEnd as Surface)
    : 'Tee';
  const defaultDistanceStart = previousShot
    ? (previousShot.surfaceEnd === 'Hole' ? (holeYardage || 0) : previousShot.distanceEnd)
    : (holeYardage || 0);

  const [surfaceStart, setSurfaceStart] = useState<Surface>(defaultSurfaceStart);
  const [distanceStart, setDistanceStart] = useState(defaultDistanceStart);
  const [surfaceEnd, setSurfaceEnd] = useState<EndSurface>('Fairway');
  const [distanceEnd, setDistanceEnd] = useState(0);
  const [penalty, setPenalty] = useState(false);
  const [category, setCategory] = useState<Category>(() => inferCategory(defaultSurfaceStart, par, shotNumber, defaultDistanceStart));
  const [clubUsed, setClubUsed] = useState('');
  const [shotResult, setShotResult] = useState<string>('');
  const [shotDetails, setShotDetails] = useState<ShotDetails>({});

  // Update category when surface or distance changes
  useEffect(() => {
    const newCategory = inferCategory(surfaceStart, par, shotNumber, distanceStart);
    setCategory(newCategory);
    if (newCategory === 'Putting') setClubUsed('Putter');
  }, [surfaceStart, par, shotNumber, distanceStart]);

  // Auto-determine shot result when end surface changes
  useEffect(() => {
    const auto = autoShotResult(surfaceEnd, par, shotNumber, category);
    if (auto) {
      setShotResult(auto);
    } else if (shotResult && surfaceEnd !== 'Green' && surfaceEnd !== 'Hole') {
      // Clear auto-set results when surface changes away from green
      const ctx = getShotResultContext(par, shotNumber, category);
      const positiveResults = ['GIR', 'Green', 'Hit Fairway', 'Drive Green'];
      if (positiveResults.includes(shotResult) && ctx) {
        setShotResult('');
      }
    }
  }, [surfaceEnd, par, shotNumber, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get contextual result options
  const resultContext = useMemo(
    () => getShotResultContext(par, shotNumber, category),
    [par, shotNumber, category]
  );

  // Determine which results are "positive" for styling
  const isPositiveResult = (result: string) =>
    ['GIR', 'Green', 'Hit Fairway', 'Drive Green'].includes(result);

  // Real-time SG preview
  const sgPreview = useMemo(() => {
    if (!distanceStart || (!distanceEnd && surfaceEnd !== 'Hole')) return null;
    return calculateStrokesGained(benchmarks, {
      surfaceStart,
      distanceStart,
      surfaceEnd,
      distanceEnd: surfaceEnd === 'Hole' ? 0 : distanceEnd,
      penalty,
    });
  }, [benchmarks, surfaceStart, distanceStart, surfaceEnd, distanceEnd, penalty]);

  const handleSubmit = () => {
    if (!distanceStart) return;
    if (!distanceEnd && surfaceEnd !== 'Hole') return;

    const sg = calculateStrokesGained(benchmarks, {
      surfaceStart,
      distanceStart,
      surfaceEnd,
      distanceEnd: surfaceEnd === 'Hole' ? 0 : distanceEnd,
      penalty,
    });

    onAddShot({
      playerId,
      hole,
      par,
      category,
      surfaceStart,
      distanceStart,
      surfaceEnd,
      distanceEnd: surfaceEnd === 'Hole' ? 0 : distanceEnd,
      clubUsed: clubUsed || undefined,
      shotResult: shotResult || undefined,
      shotDetails: Object.keys(shotDetails).length > 0 ? shotDetails : undefined,
      penalty,
      strokesGained: sg,
    });

    // Reset for next shot
    setSurfaceStart(surfaceEnd === 'Hole' ? 'Tee' : surfaceEnd as Surface);
    setDistanceStart(surfaceEnd === 'Hole' ? 0 : distanceEnd);
    setSurfaceEnd('Fairway');
    setDistanceEnd(0);
    setPenalty(false);
    setClubUsed('');
    setShotResult('');
    setShotDetails({});
  };

  const sgColor = sgPreview !== null
    ? sgPreview > 0 ? 'text-sg-positive bg-sg-positive/10' : sgPreview < 0 ? 'text-sg-negative bg-sg-negative/10' : 'text-sg-neutral'
    : '';

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary font-semibold">Shot {shotNumber}</h3>
        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
          category === 'Driving' ? 'bg-cat-driving/20 text-cat-driving' :
          category === 'Approach' ? 'bg-cat-approach/20 text-cat-approach' :
          category === 'Short Game' ? 'bg-cat-shortgame/20 text-cat-shortgame' :
          'bg-cat-putting/20 text-cat-putting'
        }`}>
          {category}
        </span>
      </div>

      {/* Start */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-secondary text-xs mb-1 block">From</label>
          <select
            value={surfaceStart}
            onChange={(e) => setSurfaceStart(e.target.value as Surface)}
            className="w-full text-sm"
          >
            {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-text-secondary text-xs mb-1 block">
            Distance ({surfaceStart === 'Green' ? 'ft' : 'yds'})
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={distanceStart || ''}
            onChange={(e) => setDistanceStart(Number(e.target.value))}
            className="w-full text-sm"
            placeholder="0"
          />
        </div>
      </div>

      {/* End */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-secondary text-xs mb-1 block">To</label>
          <select
            value={surfaceEnd}
            onChange={(e) => setSurfaceEnd(e.target.value as EndSurface)}
            className="w-full text-sm"
          >
            {END_SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-text-secondary text-xs mb-1 block">
            Distance ({surfaceEnd === 'Green' ? 'ft' : 'yds'})
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={surfaceEnd === 'Hole' ? '' : (distanceEnd || '')}
            onChange={(e) => setDistanceEnd(Number(e.target.value))}
            disabled={surfaceEnd === 'Hole'}
            className="w-full text-sm disabled:opacity-40"
            placeholder={surfaceEnd === 'Hole' ? '—' : '0'}
          />
        </div>
      </div>

      {/* Contextual Shot Result */}
      {resultContext && (
        <div>
          <label className="text-text-secondary text-xs mb-1.5 block">{resultContext.label}</label>
          <div className={`grid gap-1.5 ${
            resultContext.options.length <= 4 ? 'grid-cols-4' :
            resultContext.options.length <= 5 ? 'grid-cols-3 sm:grid-cols-5' :
            'grid-cols-3'
          }`}>
            {resultContext.options.map((opt) => {
              const isPositive = isPositiveResult(opt);
              const isNeutral = opt === 'Layup';
              const isSelected = shotResult === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setShotResult(isSelected ? '' : opt)}
                  className={`py-2.5 rounded-lg text-xs font-medium border transition-colors min-h-[44px] ${
                    isSelected
                      ? isPositive
                        ? 'border-sg-positive bg-sg-positive/15 text-sg-positive'
                        : isNeutral
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-sg-negative bg-sg-negative/15 text-sg-negative'
                      : 'border-border text-text-muted hover:border-text-muted'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible Details */}
      <ShotDetailsPanel
        category={category}
        details={shotDetails}
        onChange={setShotDetails}
      />

      {/* Category override + Club */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full text-sm"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Club</label>
          <select
            value={clubUsed}
            onChange={(e) => setClubUsed(e.target.value)}
            className="w-full text-sm"
          >
            <option value="">—</option>
            {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Penalty */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={penalty}
          onChange={(e) => setPenalty(e.target.checked)}
          className="w-5 h-5 rounded border-border accent-sg-negative"
        />
        <span className="text-text-secondary text-sm">Penalty stroke</span>
      </label>

      {/* SG Preview + Submit */}
      <div className="flex items-center gap-3">
        {sgPreview !== null && (
          <div className={`flex-1 text-center py-3 rounded-lg font-bold text-lg ${sgColor}`}>
            {formatSG(sgPreview)}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!distanceStart || (!distanceEnd && surfaceEnd !== 'Hole')}
          className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
        >
          Add Shot
        </button>
      </div>
    </div>
  );
};

export default ShotForm;
