import { Switch } from "@headlessui/react";
import { Controller } from 'react-hook-form';
import { classNames } from "~/lib/classNames";

export const SwitchGroupSetting = (props: {
  mainLine: string,
  description: string,
  control: any,
  name: string,
}) => {
  return(
    <Switch.Group as="li" className="flex items-center justify-between py-4">
    <div className="flex flex-col">
      <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
        {props.mainLine}
      </Switch.Label>
      <Switch.Description className="text-sm text-gray-500">
        {props.description}
      </Switch.Description>
    </div>
    <Controller
      defaultValue={true}
      control={props.control}
      name={props.name}
      render={({ field: { onChange, value } }) => (
        <Switch
          checked={value}
          onChange={(val: boolean) => {
            onChange(val);
          }}
          className={classNames(
            value ? 'bg-teams_brand_500' : 'bg-gray-200',
            'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2'
          )}
        >
          <span
            aria-hidden="true"
            className={classNames(
              value ? 'translate-x-5' : 'translate-x-0',
              'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
            )}
          />
        </Switch>
      )}
    />
  </Switch.Group>
  )
}