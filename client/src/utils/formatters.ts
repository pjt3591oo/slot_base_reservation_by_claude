export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (date: string): string => {
  return new Date(date).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getTimeRemaining = (expiresAt: string): string => {
  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;

  if (diff <= 0) return '만료됨';

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${minutes}분 ${seconds}초`;
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'confirmed':
      return 'text-green-600 bg-green-100';
    case 'cancelled':
      return 'text-gray-600 bg-gray-100';
    case 'expired':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const getStatusText = (status: string): string => {
  switch (status) {
    case 'pending':
      return '예약 대기';
    case 'confirmed':
      return '예약 확정';
    case 'cancelled':
      return '예약 취소';
    case 'expired':
      return '만료됨';
    default:
      return status;
  }
};

export const getOccupancyColor = (occupancyRate: number): string => {
  if (occupancyRate >= 90) return 'text-red-600';
  if (occupancyRate >= 70) return 'text-yellow-600';
  return 'text-green-600';
};