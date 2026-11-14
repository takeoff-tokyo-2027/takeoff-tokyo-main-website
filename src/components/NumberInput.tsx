import { useId, useRef, useState, type InputHTMLAttributes } from 'react';

interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'defaultValue'
> {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  compact?: boolean;
}

export function NumberInput({
  label,
  value,
  defaultValue = '',
  onValueChange,
  compact = false,
  id,
  disabled,
  readOnly,
  min,
  max,
  step = 1,
  inputMode,
  className = '',
  ...props
}: NumberInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const input = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState<string | number>(defaultValue);
  const current = value ?? localValue;
  const hasValue = current !== '' && Number.isFinite(Number(current));

  function update(next: string) {
    setLocalValue(next);
    onValueChange?.(next);
  }

  function change(direction: 'up' | 'down') {
    if (!input.current) return;
    if (direction === 'up') input.current.stepUp();
    else input.current.stepDown();
    update(input.current.value);
  }

  return (
    <div className={`number-field${compact ? ' number-field--compact' : ''} ${className}`}>
      {!compact && <label htmlFor={inputId}>{label}</label>}
      <div className="number-input">
        <button
          type="button"
          className="number-input__button"
          aria-label={`Decrease ${label}`}
          aria-controls={inputId}
          disabled={
            disabled ||
            readOnly ||
            (hasValue && min !== undefined && Number(current) <= Number(min))
          }
          onClick={() => change('down')}
        >
          −
        </button>
        <input
          {...props}
          ref={input}
          id={inputId}
          className="number-input__value"
          type="number"
          aria-label={compact ? label : undefined}
          inputMode={inputMode ?? (Number.isInteger(Number(step)) ? 'numeric' : 'decimal')}
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => update(event.target.value)}
        />
        <button
          type="button"
          className="number-input__button"
          aria-label={`Increase ${label}`}
          aria-controls={inputId}
          disabled={
            disabled ||
            readOnly ||
            (hasValue && max !== undefined && Number(current) >= Number(max))
          }
          onClick={() => change('up')}
        >
          +
        </button>
      </div>
    </div>
  );
}
