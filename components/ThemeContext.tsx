import React, { createContext, useReducer, useEffect, ReactNode } from 'react';

// Define action types
const TOGGLE_THEME = 'TOGGLE_THEME';

// Reducer function to manage theme state
function themeReducer(state: string, action: { type: string }) {
  switch (action.type) {
    case TOGGLE_THEME:
      return state === 'dark' ? 'light' : 'dark';
    default:
      return state;
  }
}

// Create the context
const ThemeContext = createContext<[string, () => void] | undefined>(undefined);

// ThemeProvider component
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, dispatch] = useReducer(themeReducer, 'light', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.theme === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      const colorTheme = theme === 'dark' ? 'light' : 'dark';

      root.classList.remove(colorTheme);
      root.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    dispatch({ type: TOGGLE_THEME });
  };

  return (
    <ThemeContext.Provider value={[theme, toggleTheme]}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the ThemeContext
export const useDarkSide = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useDarkSide must be used within a ThemeProvider');
  }
  return context;
};
