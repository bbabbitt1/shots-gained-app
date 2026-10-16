import { useState } from 'react';
import Icon from './Icons';
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
  multi?: boolean;
}

const getFieldsForCategory = (category: Category): FieldConfig[] => {
  switch (category) {
    case 'Driving':
      return [
        { key: 'intendedShape', label: 'Shot Shape', options: INTENDED_SHAPES },
        { key: 'fairwayWidth', label: 'Fairway', options: FAIRWAY_WIDTHS },
        { key: 'windDirection', label: 'Wind Dir', options: WIND_DIRECTIONS, multi: true },
        { key: 'windStrength', label: 'Wind', options: WIND_STRENGTHS },
      ];
    case 'Approach':
      return [
        { key: 'pinDepth', label: 'Pin Depth', options: PIN_DEPTHS },
        { key: 'pinSide', label: 'Pin Side', options: PIN_SIDES },
        { key: 'greenFirmness', label: 'Firmness', options: GREEN_FIRMNESS },
        { key: 'windDirection', label: 'Wind Dir', options: WIND_DIRECTIONS, multi: true },
        { key: 'windStrength', label: 'Wind', options: WIND_STRENGTHS },
        { key: 'lieQuality', label: 'Lie', options: LIE_QUALITIES },
      ];
    case 'Short Game':
      return [
        { key: 'shotType', label: 'Shot Type', options: SHORT_GAME_TYPES },
        { key: 'lieQuality', label: 'Lie', options: LIE_QUALITIES },
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
        className={`chip px-3.5 text-xs ${
          value === opt
            ? 'ring-accent bg-accent/15 text-accent'
            : 'ring-white/10 text-text-secondary hover:ring-white/25'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const PillMultiSelect = ({ options, value, onChange }: { options: readonly string[]; value?: string[]; onChange: (v: string[] | undefined) => void }) => {
  const selected = value || [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = isSelected
                ? selected.filter((s) => s !== opt)
                : [...selected, opt];
              onChange(next.length > 0 ? next : undefined);
            }}
            className={`chip px-3.5 text-xs ${
              isSelected
                ? 'ring-accent bg-accent/15 text-accent'
                : 'ring-white/10 text-text-secondary hover:ring-white/25'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
};

const ShotDetailsPanel = ({ category, details, onChange }: ShotDetailsPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const fields = getFieldsForCategory(category);

  // Count filled fields
  const filled = fields.filter((f) => {
    const val = (details as Record<string, unknown>)[f.key];
    return f.multi ? Array.isArray(val) && val.length > 0 : !!val;
  }).length;

  const handleFieldChange = (key: string, value: string | string[] | undefined) => {
    onChange({ ...details, [key]: value });
  };

  return (
    <div className="tile overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 min-h-[48px] hover:bg-white/[0.03] transition-colors duration-200 ease-spring"
      >
        <span className="text-text-secondary text-xs font-medium">
          Details
          {filled > 0 && <span className="text-accent ml-1.5">({filled})</span>}
        </span>
        <Icon name="chevronRight" className={`w-4 h-4 text-text-muted transition-transform duration-300 ease-spring ${expanded ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          {fields.map((field) => (
            <div key={field.key} className="pt-2">
              <label className="eyebrow mb-1 block">
                {field.label}
              </label>
              {field.multi ? (
                <PillMultiSelect
                  options={field.options}
                  value={(details as Record<string, string[] | undefined>)[field.key]}
                  onChange={(v) => handleFieldChange(field.key, v)}
                />
              ) : (
                <PillSelect
                  options={field.options}
                  value={(details as Record<string, string | undefined>)[field.key]}
                  onChange={(v) => handleFieldChange(field.key, v)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShotDetailsPanel;
