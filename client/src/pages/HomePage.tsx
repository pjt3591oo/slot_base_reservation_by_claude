import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          자율석 예매 시스템
        </h1>
        <p className="text-xl text-gray-600">
          원하는 구역을 선택하고 편리하게 예매하세요
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h2 className="text-2xl font-semibold mb-6">공연 정보</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-700 mb-2">공연명</h3>
            <p className="text-gray-900">2024 뮤직 페스티벌</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 mb-2">일시</h3>
            <p className="text-gray-900">2024년 12월 25일 오후 7시</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 mb-2">장소</h3>
            <p className="text-gray-900">올림픽공원 체조경기장</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 mb-2">예매 가능 시간</h3>
            <p className="text-gray-900">24시간 예매 가능</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">예매 안내</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            자율석은 구역별로 예매가 가능하며, 지정된 좌석은 없습니다
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            예약 후 15분 이내에 결제를 완료해주세요
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            한 번에 최대 10명까지 예매 가능합니다
          </li>
        </ul>
      </div>

      <div className="text-center">
        <Link
          to="/sections"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          예매하기
          <svg className="ml-2 -mr-1 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
};

export default HomePage;