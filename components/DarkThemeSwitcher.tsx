import React, { useState } from 'react';
import { DarkModeSwitch } from 'react-toggle-dark-mode';
import useDarkSide from '~/helper/useDarkSide';

export default function DarkThemeSwitcher() {
  const [colorTheme, setTheme] = useDarkSide() as [string, React.Dispatch<React.SetStateAction<string>>];

  const [darkSide, setDarkSide] = useState(colorTheme === 'light' ? true : false);

  const toggleDarkMode = (checked:any) => {
    setTheme(colorTheme);
    setDarkSide(checked);
  };

  return (
    <>
      <div>
        <DarkModeSwitch checked={darkSide} onChange={toggleDarkMode} size={26} />
      </div>
    </>
  );
}