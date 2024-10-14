import React from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';

import Timeline from './Timeline/Timeline';
import { CalendarViewProvider } from '@components/calendar/CalendarViewContext';

const Start = () => {
 

  return (
    <CalendarViewProvider>
      <Timeline />
      <ReactTooltip id="cell-tooltip" className="z-50" />
    </CalendarViewProvider>
  );
};

export default Start;
