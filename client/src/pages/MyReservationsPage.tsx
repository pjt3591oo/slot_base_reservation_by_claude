import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useReservationStore from '../stores/reservationStore';
import useUserStore from '../stores/userStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPrice, formatDate, getStatusColor, getStatusText } from '../utils/formatters';
import { type Reservation } from '../types';

const MyReservationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useUserStore();
  const { userReservations, loading, error, fetchUserReservations, cancelReservation } = useReservationStore();
  const [filter, setFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    fetchUserReservations(userId, filter === 'all' ? undefined : filter);
  }, [userId, filter, navigate]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    if (userId) {
      fetchUserReservations(userId, newFilter === 'all' ? undefined : newFilter);
    }
  };

  const handleCancel = async (reservation: Reservation) => {
    if (!userId) return;
    
    if (!window.confirm('이 예약을 취소하시겠습니까?')) {
      return;
    }

    setCancellingId(reservation.id);
    try {
      await cancelReservation(reservation.id, userId);
    } catch (error) {
      console.error('Failed to cancel reservation:', error);
    }
    setCancellingId(null);
  };

  const handleViewDetail = (reservation: Reservation) => {
    navigate(`/reservation/${reservation.id}/confirm`);
  };

  if (loading && userReservations.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">내 예약 목록</h2>
        <p className="text-gray-600">예약 내역을 확인하고 관리할 수 있습니다.</p>
      </div>

      <div className="mb-6">
        <div className="flex space-x-2">
          {['all', 'pending', 'confirmed', 'cancelled', 'expired'].map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? '전체' : getStatusText(status)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {userReservations.map((reservation) => (
          <div key={reservation.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {reservation.section?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  예약번호: {reservation.confirmationCode}
                </p>
              </div>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(reservation.status)}`}>
                {getStatusText(reservation.status)}
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">예약 일시</p>
                <p className="font-medium">{formatDate(reservation.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">예약 인원</p>
                <p className="font-medium">{reservation.quantity}명</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">총 금액</p>
                <p className="font-medium text-blue-600">
                  {formatPrice(reservation.totalPrice || 0)}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => handleViewDetail(reservation)}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                상세보기
              </button>
              {reservation.status === 'pending' && (
                <button
                  onClick={() => handleCancel(reservation)}
                  disabled={cancellingId === reservation.id}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-500 disabled:text-gray-400"
                >
                  {cancellingId === reservation.id ? '취소 중...' : '예약 취소'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {userReservations.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-4 text-gray-600">
            {filter === 'all' ? '예약 내역이 없습니다.' : `${getStatusText(filter)} 상태의 예약이 없습니다.`}
          </p>
          <button
            onClick={() => navigate('/sections')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            예약하러 가기
          </button>
        </div>
      )}
    </div>
  );
};

export default MyReservationsPage;