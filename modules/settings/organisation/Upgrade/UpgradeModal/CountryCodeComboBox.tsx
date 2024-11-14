import { useEffect, useState } from 'react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { Combobox } from '@headlessui/react'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

interface Props {
  countries: {
    code: string,
    name: string,
  }[],
  onChange: (...event: any[]) => void,
  error: boolean,
  value: {code:string, name: string} | null,
}

export default function CountryCodeComboBox({countries, onChange, value, error}: Props) {
  const [query, setQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<{code: string, name: string} | null>(value);

  const filterCountries =
    query === ''
      ? countries
      : countries.filter((country) => {
          return country.name.toLowerCase().includes(query.toLowerCase())
        })

    useEffect(() => {
      if(selectedCountry) {
        onChange(selectedCountry.code);
      }
    },[selectedCountry])

  return (
    <Combobox as="div" value={selectedCountry || value} onChange={setSelectedCountry}>
      <div className="relative mt-2">
        <Combobox.Input
          className={`w-full rounded-md bg-white py-1.5 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 focus:ring-teams_brand_500 dark:bg-transparent dark:text-white dark:border-teams_brand_border ${error ? 'border border-red-500' : 'border-0'}`}
          onChange={(event) => setQuery(event.target.value)}
          defaultValue={countries[0]?.name || ''}
          //@ts-ignore
          displayValue={(country) => country?.name || ''}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
          <ChevronUpDownIcon className="h-5 w-5 text-gray-400 dark:text-white" aria-hidden="true" />
        </Combobox.Button>

        {filterCountries.length > 0 && (
          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm dark:bg-neutral-700 ">
            {filterCountries.map((country) => (
              <Combobox.Option
                key={country.code}
                value={country}
                className={({ active }) =>
                  classNames(
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active ? 'bg-teams_brand_foreground_bg text-white dark:bg-teams_brand_tbody' : 'text-gray-900 dark:text-white'
                  )
                }
              >
                {({ active, selected }) => (
                  <>
                    <span className={classNames('block truncate', selected && 'font-semibold')}>{country.name}</span>

                    {selected && (
                      <span
                        className={classNames(
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-white' : 'text-black'
                        )}
                      >
                        <CheckIcon className="h-5 w-5 dark:text-white" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        )}
      </div>
    </Combobox>
  )
}
