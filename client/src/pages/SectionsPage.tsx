import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useReservationStore from '../stores/reservationStore';
import useUserStore from '../stores/userStore';
import SectionCard from '../components/SectionCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { type Section } from '../types';

const SectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useUserStore();
  const { sections, loading, error, fetchSections, selectSection, setQuantity, clearError } = useReservationStore();

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    // Initial fetch
    fetchSections();

    // Set up auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchSections();
    }, 5000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [userId, navigate]);

  const handleSelectSection = (section: Section) => {
    selectSection(section);
    navigate('/reservation');
  };

  if (loading && sections.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">구역 선택</h2>
        <p className="text-gray-600">원하시는 구역을 선택해주세요. 실시간으로 잔여석이 업데이트됩니다.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={() => {
                  clearError();
                  fetchSections();
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-500"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            onSelect={handleSelectSection}
          />
        ))}
      </div>

      {sections.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">현재 예약 가능한 구역이 없습니다.</p>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm text-gray-600 bg-gray-100">
          <svg className="w-4 h-4 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          5초마다 자동 새로고침
        </div>
      </div>
    </div>
  );
};

export default SectionsPage;