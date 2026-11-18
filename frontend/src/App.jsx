import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ArgusDashboard from './components/ArgusDashboard';
import './App.css';

// Create a custom premium dark theme modeled after ARGUS UI
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f05a28', // ARGUS Orange accent
      contrastText: '#fff'
    },
    secondary: {
      main: '#00b0ff' // Light blue accent
    },
    background: {
      default: '#090a0f', // Main backdrop
      paper: '#12131a' // Element card container
    },
    text: {
      primary: '#e3e4e8',
      secondary: '#9598a3'
    },
    border: '#222430'
  },
  typography: {
    fontFamily: [
      'Outfit',
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif'
    ].join(','),
    h5: {
      fontWeight: 700,
      color: '#fff'
    },
    subtitle2: {
      fontWeight: 600,
      color: '#9598a3'
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 6,
          borderColor: '#222430'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 6,
          backgroundColor: '#181922',
          borderColor: '#222430',
          borderWidth: 1,
          borderStyle: 'solid',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#222430',
          padding: '12px 16px'
        },
        head: {
          fontWeight: 700,
          color: '#9598a3',
          backgroundColor: '#1c1e28'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 20,
          fontWeight: 600,
          fontSize: 13
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 4
        }
      }
    }
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ArgusDashboard />} />
          <Route path="/admin" element={<ArgusDashboard />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
