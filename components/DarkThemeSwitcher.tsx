import React from 'react';
import { DarkModeSwitch } from 'react-toggle-dark-mode';
import { useDarkSide } from './ThemeContext'; // Adjust the path as necessary

export default function DarkThemeSwitcher() {
  const [theme, toggleTheme] = useDarkSide(); // Use the hook to get theme and toggle function

  const isDarkMode = theme === 'dark';
  return (
    <div>
      <DarkModeSwitch checked={isDarkMode} onChange={toggleTheme} size={26} />
    </div>
  );
}
