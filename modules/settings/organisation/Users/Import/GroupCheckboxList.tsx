import React, { ChangeEvent } from 'react';
import { RouterOutputs } from '~/utils/api';

interface GroupCheckboxListProps {
  groups: RouterOutputs['workspace']['getMicrosoftGroups'];
  selectedGroups: string[];
  onGroupSelectionChange: (isChecked: boolean, group: RouterOutputs['workspace']['getMicrosoftGroups'][0]) => void;
}

const GroupCheckboxList: React.FC<GroupCheckboxListProps> = ({ groups, selectedGroups, onGroupSelectionChange }) => {
  const handleGroupChange = (
    event: ChangeEvent<HTMLInputElement>,
    group: RouterOutputs['workspace']['getMicrosoftGroups'][0]
  ) => {
    onGroupSelectionChange(event.target.checked, group);
  };
  if (!groups) return null;
  return (
    <div className="max-h-80 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.id} className="flex items-center ml-3 py-0.5">     
          <input
            type="checkbox"
            id={group.id}
            className="focus:ring-teams_brand_500 h-4 w-4 text-teams_brand_600 border-gray-300 rounded dark:bg-teams_brand_dark_100 dark:text-gray-200  dark:border-gray-200  dark:focus:ring-teams_brand_dark_100 dark:focus:bg-teams_brand_dark_100"
            checked={selectedGroups.includes(group.id)}
            onChange={(event) => handleGroupChange(event, group)}
          />
          <label htmlFor={group.id} className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-200" >
            {group.displayName} - {group.description}
          </label>
        </div>
      ))}
    </div>
  );
};

export default GroupCheckboxList;
