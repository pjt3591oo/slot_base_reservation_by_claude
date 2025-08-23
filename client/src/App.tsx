import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SectionsPage from './pages/SectionsPage';
import ReservationPage from './pages/ReservationPage';
import ReservationConfirmPage from './pages/ReservationConfirmPage';
import MyReservationsPage from './pages/MyReservationsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="sections" element={<SectionsPage />} />
          <Route path="reservation" element={<ReservationPage />} />
          <Route path="reservation/:id/confirm" element={<ReservationConfirmPage />} />
          <Route path="my-reservations" element={<MyReservationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;