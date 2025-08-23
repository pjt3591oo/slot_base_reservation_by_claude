import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useReservationStore from '../stores/reservationStore';
import useUserStore from '../stores/userStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPrice } from '../utils/formatters';

const ReservationPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId, userName, userEmail } = useUserStore();
  const { 
    selectedSection, 
    selectedQuantity, 
    loading, 
    error, 
    setQuantity, 
    createReservation,
    clearError 
  } = useReservationStore();
  
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => {
    if (!userId || !selectedSection) {
      navigate('/sections');
    }
  }, [userId, selectedSection, navigate]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setQuantity(parseInt(e.target.value));
  };

  const handleCreateReservation = async () => {
    if (!userId) return;
    
    setIsCreating(true);
    const reservation = await createReservation(userId);
    
    if (reservation) {
      navigate(`/reservation/${reservation.id}/confirm`);
    }
    setIsCreating(false);
  };

  if (!selectedSection) {
    return null;
  }

  const totalPrice = selectedSection.price * selectedQuantity;
  const maxQuantity = Math.min(10, selectedSection.availableSeats);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">예약 정보 확인</h2>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">선택한 구역</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">구역명</span>
            <span className="font-medium">{selectedSection.name}</span>
          </div>
          {selectedSection.location && (
            <div className="flex justify-between">
              <span className="text-gray-600">위치</span>
              <span className="font-medium">{selectedSection.location}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">1인 가격</span>
            <span className="font-medium">{formatPrice(selectedSection.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">잔여 좌석</span>
            <span className="font-medium">{selectedSection.availableSeats}석</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">예약 인원</h3>
        <div className="flex items-center space-x-4">
          <label htmlFor="quantity" className="text-gray-600">인원수</label>
          <select
            id="quantity"
            value={selectedQuantity}
            onChange={handleQuantityChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                {num}명
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <div className="flex justify-between text-lg font-semibold">
            <span>총 금액</span>
            <span className="text-blue-600">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">예약자 정보</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={userName || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={userEmail || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          onClick={() => navigate('/sections')}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          이전으로
        </button>
        <button
          onClick={handleCreateReservation}
          disabled={loading || isCreating}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {(loading || isCreating) ? (
            <>
              <LoadingSpinner size="small" className="mr-2" />
              예약 중...
            </>
          ) : (
            '예약하기'
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800">
          예약 후 15분 이내에 결제를 완료해주세요. 시간 초과 시 자동으로 취소됩니다.
        </p>
      </div>
    </div>
  );
};

export default ReservationPage;