import { useState } from 'react'
import { listSupportedCountries, toE164 } from '@surescore/shared'

const COUNTRIES = listSupportedCountries()

/**
 * Mobile number with its country code. Calls `onChange` with the E.164 number
 * ("+2348012345678"), or null while the typed number is not valid yet.
 */
export function PhoneField({ label = 'Phone number', onChange }: { label?: string; onChange: (e164: string | null) => void }) {
  const [countryCode, setCountryCode] = useState(COUNTRIES[0]?.code ?? '')
  const [number, setNumber] = useState('')
  const [touched, setTouched] = useState(false)

  const update = (nextCountry: string, nextNumber: string) => {
    setCountryCode(nextCountry)
    setNumber(nextNumber)
    onChange(toE164(nextCountry, nextNumber))
  }
  const invalid = touched && number.trim() !== '' && !toE164(countryCode, number)

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          className="h-12 shrink-0 rounded-2xl border border-input bg-transparent px-3"
          value={countryCode}
          onChange={(e) => update(e.target.value, number)}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} +{c.dialCode}
            </option>
          ))}
        </select>
        <input
          className="h-12 w-full min-w-0 rounded-2xl border border-input bg-transparent px-4"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="0801 234 5678"
          required
          value={number}
          aria-invalid={invalid}
          onBlur={() => setTouched(true)}
          onChange={(e) => update(countryCode, e.target.value)}
        />
      </div>
      {invalid && <span className="text-xs text-destructive">Enter a valid mobile number.</span>}
    </label>
  )
}
