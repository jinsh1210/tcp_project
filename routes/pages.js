const express = require("express");
const router = express.Router();
const db = require("../config/database");

// 인증 미들웨어
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

// 페이지 라우트
router.get("/", requireAuth, (req, res) => {
  res.render("index", {
    user: {
      id: req.session.userId,
      username: req.session.username,
    },
  });
});

router.get("/login", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  res.render("login");
});

router.get("/register", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  res.render("register");
});

router.get("/community", requireAuth, (req, res) => {
  res.render("index", {
    user: {
      id: req.session.userId,
      username: req.session.username,
    },
  });
});

router.get("/admin", requireAuth, async (req, res) => {
  try {
    const [users] = await db.query("SELECT role FROM users WHERE id = ?", [
      req.session.userId,
    ]);

    if (users.length === 0 || users[0].role !== "admin") {
      return res.status(403).send("관리자 권한이 필요합니다.");
    }

    res.render("admin", {
      user: {
        id: req.session.userId,
        username: req.session.username,
      },
    });
  } catch (error) {
    console.error("Admin 페이지 에러:", error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

module.exports = router;
