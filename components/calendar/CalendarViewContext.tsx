import { StartAt, EndAt } from '@prisma/client';
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

type calendarViewContextType = {
  selectionStartDate: {
    date: Date;
    at: StartAt;
    member_id: string;
  } | null;
  selectionEndDate: {
    date: Date;
    at: EndAt;
    member_id: string;
  } | null;
  mouseDown: string;
  setSelectionStartDate(
    params: {
      date: Date;
      at: StartAt;
      member_id: string;
    } | null
  ): void;
  setSelectionEndDate(
    params: {
      date: Date;
      at: EndAt;
      member_id: string;
    } | null
  ): void;
  setMouseDown(params: string): void;
};
const calendarViewContextDefaultValues: calendarViewContextType = {
  selectionStartDate: null,
  selectionEndDate: null,
  mouseDown: '',
  setSelectionStartDate: () => {},
  setSelectionEndDate: () => {},
  setMouseDown: () => {},
};
const CalendarViewContext = createContext<calendarViewContextType>(
  calendarViewContextDefaultValues
);
export function useCalendarView() {
  return useContext(CalendarViewContext);
}

type Props = {
  children: ReactNode;
};

export function CalendarViewProvider({ children }: Props) {
  const [selectionStartDate, setSelectionStartDate] = useState<{
    date: Date;
    at: StartAt;
    member_id: string;
  } | null>(null);
  const [selectionEndDate, setSelectionEndDate] = useState<{
    date: Date;
    at: EndAt;
    member_id: string;
  } | null>(null);
  const [mouseDown, setMouseDown] = useState<string>('');

  const value = {
    selectionStartDate,
    selectionEndDate,
    mouseDown,
    setSelectionStartDate,
    setSelectionEndDate,
    setMouseDown,
  };
  return (
    <>
      <CalendarViewContext.Provider value={value}>
        {children}
      </CalendarViewContext.Provider>
    </>
  );
}
