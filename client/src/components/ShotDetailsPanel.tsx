import { useState } from 'react';
import type { Category, ShotDetails } from '@shared/types';
import {
  WIND_DIRECTIONS, WIND_STRENGTHS, LIE_QUALITIES,
  INTENDED_SHAPES, FAIRWAY_WIDTHS,
  PIN_DEPTHS, PIN_SIDES, GREEN_FIRMNESS,
  SHORT_GAME_TYPES,
  BREAK_TYPES, BREAK_SEVERITIES, PUTT_SLOPES, PUTT_MISSES, GREEN_SPEEDS,
} from '@shared/types';

interface ShotDetailsPanelProps {
  category: Category;
  details: ShotDetails;
  onChange: (details: ShotDetails) => void;
}

interface FieldConfig {
  key: string;
  label: string;
  options: readonly string[];
}

const getFieldsForCategory = (category: Category): FieldConfig[] => {
  switch (category) {
    case 'Driving':
      return [
        { key: 'intendedShape', label: 'Shot Shape', options: INTENDED_SHAPES },
        { key: 'fairwayWidth', label: 'Fairway', options: FAIRWAY_WIDTHS },
        { key: 'windDirection', label: 'Wind Dir', options: WIND_DIRECTIONS },
        { key: 'windStrength', label: 'Wind', options: WIND_STRENGTHS },
        { key: 'lieQuality', label: 'Lie', options: LIE_QUALITIES },
      ];
    case 'Approach':
      return [
        { key: 'pinDepth', label: 'Pin Depth', options: PIN_DEPTHS },
        { key: 'pinSide', label: 'Pin Side', options: PIN_SIDES },
        { key: 'greenFirmness', label: 'Firmness', options: GREEN_FIRMNESS },
        { key: 'windDirection', label: 'Wind Dir', options: WIND_DIRECTIONS },
        { key: 'windStrength', label: 'Wind', options: WIND_STRENGTHS },
        { key: 'lieQuality', label: 'Lie', options: LIE_QUALITIES },
      ];
    case 'Short Game':
      return [
        { key: 'shotType', label: 'Shot Type', options: SHORT_GAME_TYPES },
        { key: 'lieQuality', label: 'Lie', options: LIE_QUALITIES },
        { key: 'windDirection', label: 'Wind Dir', options: WIND_DIRECTIONS },
        { key: 'windStrength', label: 'Wind', options: WIND_STRENGTHS },
      ];
    case 'Putting':
      return [
        { key: 'breakType', label: 'Break', options: BREAK_TYPES },
        { key: 'breakSeverity', label: 'Severity', options: BREAK_SEVERITIES },
        { key: 'puttSlope', label: 'Slope', options: PUTT_SLOPES },
        { key: 'puttMiss', label: 'Miss', options: PUTT_MISSES },
        { key: 'greenSpeed', label: 'Speed', options: GREEN_SPEEDS },
      ];
  }
};

const PillSelect = ({ options, value, onChange }: { options: readonly string[]; value?: string; onChange: (v: string | undefined) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? undefined : opt)}
        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors min-h-[44px] ${
          value === opt
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-border text-text-muted hover:border-text-muted'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const ShotDetailsPanel = ({ category, details, onChange }: ShotDetailsPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const fields = getFieldsForCategory(category);

  // Count filled fields
  const filled = fields.filter((f) => (details as Record<string, unknown>)[f.key]).length;

  const handleFieldChange = (key: string, value: string | undefined) => {
    onChange({ ...details, [key]: value });
  };

  return (
    <div className="bg-bg-surface border border-border/50 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] hover:bg-bg-card/50 transition-colors"
      >
        <span className="text-text-secondary text-xs font-medium">
          Details
          {filled > 0 && <span className="text-accent ml-1.5">({filled})</span>}
        </span>
        <span className="text-text-muted text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/30">
          {fields.map((field) => (
            <div key={field.key} className="pt-2">
              <label className="text-text-secondary text-xs uppercase tracking-wider mb-1 block">
                {field.label}
              </label>
              <PillSelect
                options={field.options}
                value={(details as Record<string, string | undefined>)[field.key]}
                onChange={(v) => handleFieldChange(field.key, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShotDetailsPanel;
