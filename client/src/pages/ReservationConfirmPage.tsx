import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useReservationStore from '../stores/reservationStore';
import useUserStore from '../stores/userStore';
import ReservationTimer from '../components/ReservationTimer';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPrice, formatDate } from '../utils/formatters';
import api from '../services/api';

const ReservationConfirmPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useUserStore();
  const { currentReservation, loading, error, confirmReservation, cancelReservation } = useReservationStore();
  const [reservation, setReservation] = useState(currentReservation);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!userId || !id) {
      navigate('/');
      return;
    }

    // If no current reservation, fetch it
    if (!currentReservation || currentReservation.id !== id) {
      fetchReservation();
    }
  }, [userId, id]);

  const fetchReservation = async () => {
    if (!userId || !id) return;
    
    try {
      const response = await api.getReservation(id, userId);
      if (response.success && response.data) {
        setReservation(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch reservation:', error);
      navigate('/my-reservations');
    }
  };

  const handleConfirm = async () => {
    if (!userId || !reservation) return;
    
    setIsConfirming(true);
    try {
      await confirmReservation(reservation.id, userId);
      navigate('/my-reservations');
    } catch (error) {
      console.error('Failed to confirm reservation:', error);
    }
    setIsConfirming(false);
  };

  const handleCancel = async () => {
    if (!userId || !reservation) return;
    
    if (!window.confirm('예약을 취소하시겠습니까?')) {
      return;
    }
    
    setIsCancelling(true);
    try {
      await cancelReservation(reservation.id, userId);
      navigate('/my-reservations');
    } catch (error) {
      console.error('Failed to cancel reservation:', error);
    }
    setIsCancelling(false);
  };

  const handleExpired = () => {
    navigate('/my-reservations');
  };

  if (loading || !reservation) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const isExpired = new Date() > new Date(reservation.expiresAt);
  const isPending = reservation.status === 'pending' && !isExpired;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {reservation.status === 'pending' ? '예약 확인' : '예약 상세'}
          </h2>
          {isPending && (
            <ReservationTimer 
              expiresAt={reservation.expiresAt} 
              onExpired={handleExpired}
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4">예약 정보</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">예약 번호</span>
                <span className="font-mono font-medium">{reservation.confirmationCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">예약 상태</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {reservation.status === 'confirmed' ? '확정' : 
                   reservation.status === 'pending' ? '대기중' : '취소됨'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">예약 일시</span>
                <span className="font-medium">{formatDate(reservation.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4">구역 정보</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">구역명</span>
                <span className="font-medium">{reservation.section?.name}</span>
              </div>
              {reservation.section?.location && (
                <div className="flex justify-between">
                  <span className="text-gray-600">위치</span>
                  <span className="font-medium">{reservation.section.location}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">예약 인원</span>
                <span className="font-medium">{reservation.quantity}명</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">결제 정보</h3>
            <div className="p-4 bg-gray-50 rounded-md">
              <div className="flex justify-between text-lg font-semibold">
                <span>총 금액</span>
                <span className="text-blue-600">
                  {formatPrice(reservation.totalPrice || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-8 flex space-x-4">
          {isPending && (
            <>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors disabled:bg-gray-100"
              >
                {isCancelling ? '취소 중...' : '예약 취소'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center"
              >
                {isConfirming ? (
                  <>
                    <LoadingSpinner size="small" className="mr-2" />
                    확정 중...
                  </>
                ) : (
                  '예약 확정'
                )}
              </button>
            </>
          )}
          {!isPending && (
            <button
              onClick={() => navigate('/my-reservations')}
              className="w-full px-6 py-3 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              내 예약 목록으로
            </button>
          )}
        </div>

        {isPending && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              예약 확정 버튼을 눌러 결제를 완료해주세요. 
              시간 초과 시 자동으로 취소됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservationConfirmPage;