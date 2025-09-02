export default function HomePage() {
  console.log('HomePage component rendering');
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Chinese Page Working! 中文页面正常工作！
        </h1>
        <p className="text-lg text-gray-600">
          The /zh route is now working correctly.
        </p>
      </div>
    </div>
  );
}
