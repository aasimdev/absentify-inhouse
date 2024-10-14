import { useState } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';
const InlineEdit = (props: { text: string | undefined; onChange: Function }) => {
  const [editMode, setEditMode] = useState<boolean>(false);
  const [value, setValue] = useState<string | undefined>(props.text);
  if (!editMode)
    return (
      <div
        className="w-full cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          setEditMode(true);
        }}
      >
        <span
          className="w-24 truncate"
          data-tooltip-id="lt-tooltip"
          data-tooltip-content={props.text}
          data-tooltip-variant="light"
        >
          {props.text}
        </span>
        <ReactTooltip id="lt-tooltip" place="top" className="shadow z-50" classNameArrow="shadow-sm" />
      </div>
    );
  return (
    <input
      type="text"
      name="name"
      id="name"
      onChange={(x) => {
        setValue(x.target.value);
      }}
      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-gray-200 focus:outline-none focus:ring-transparent sm:text-sm"
      onBlur={(x) => {
        setEditMode(false);
        props.onChange(x.target.value);
      }}
      value={value}
    ></input>
  );
};

export default InlineEdit;
