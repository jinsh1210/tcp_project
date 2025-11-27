// Async handler wrapper to catch errors in async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error("라우트 에러:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  });
};

module.exports = asyncHandler;
