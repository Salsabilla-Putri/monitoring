<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Gen-Track — Home Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <link href="css/style.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

  <style>
    body {
      background:#f1f5f9;
      font-family:Arial, sans-serif;
      margin:0;
      overflow-x:hidden;
    }

    /* ---------------- SIDEBAR ---------------- */
    .sidebar {
      width:100px;
      height:100vh;
      background:#183153;
      position:fixed;
      left:0;
      top:0;
      display:flex;
      flex-direction:column;
      padding-top:20px;
      color:white;
      z-index:20;
    }

    .sidebar nav {
      margin-top:20px;
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .sidebar nav a {
      text-decoration:none;
      color:white;
      text-align:center;
      padding:12px 8px;
      font-size:14px;
      display:flex;
      flex-direction:column;
      opacity:0.85;
      transition:0.25s;
    }

    .sidebar nav a.active,
    .sidebar nav a:hover {
      background:#0f223d;
      opacity:1;
      border-right:4px solid #4ade80;
    }

    .logo {
      width:70px;
      margin:0 auto 10px;
      display:block;
    }

    /* ---------------- TOPBAR ---------------- */
    .topbar {
      height:60px;
      background:white;
      border-bottom:1px solid #d0d7e1;
      position:fixed;
      left:100px;        /* mengikuti sidebar */
      right:0;
      top:0;
      z-index:10;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 24px;
      box-shadow:0 2px 4px rgba(0,0,0,0.05);
    }

    .topbar-title {
      font-size:20px;
      font-weight:bold;
      color:#183153;
    }

    .topbar-user {
      background:#183153;
      color:white;
      padding:8px 16px;
      border-radius:20px;
      font-size:14px;
      cursor:pointer;
      transition:0.2s;
    }

    .topbar-user:hover {
      background:#0f223d;
    }

    /* ---------------- MAIN CONTENT ---------------- */
    .main-content {
      margin-left:100px;      /* ruang sidebar */
      padding-top:80px;       /* ruang topbar */
    }

    /* ---------------- HERO SECTION ---------------- */
    .hero {
      background:url('https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=1000&q=80') center/cover;
      height:260px;
      border-radius:14px;
      margin:32px;
      box-shadow:0 6px 32px #bcd5ef;
      position:relative;
    }

    .hero::after {
      content:"";
      position:absolute;
      inset:0;
      background:rgba(20,30,60,0.45);
      border-radius:14px;
    }

    .hero-content {
      position:relative;
      z-index:3;
      text-align:center;
      color:white;
      padding-top:45px;
    }

    .hero-time { font-size:3.2em; font-weight:800; }
    .hero-greeting { font-size:1.4em; margin-top:6px; }
    .hero-quote { font-size:1.05em; opacity:0.9; margin-top:8px; font-style:italic; }

    /* ---------------- GRID ---------------- */
    .grid-2 {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:22px;
      padding:0 32px;
      margin-top:18px;
    }

    /* ---------------- CARD ---------------- */
    .card {
      background:white;
      border-radius:12px;
      padding:18px 24px;
      box-shadow:0 2px 12px rgba(0,0,0,0.08);
    }

    .card h3 {
      background:#1745a5;
      color:white;
      padding:8px 14px;
      border-radius:8px;
      margin:-18px -24px 16px -24px;
      font-size:1.15em;
    }

    .list-row {
      display:flex;
      justify-content:space-between;
      padding:6px 0;
      border-bottom:1px solid #eee;
      font-size:0.98em;
    }

    .list-row:last-child { border-bottom:none; }

    .chart-box { height:260px; }

    .status-red { color:#e63946; font-weight:bold; }
    .status-blue { color:#457b9d; font-weight:bold; }
  </style>
</head>
<body>

  <!-- ===== SIDEBAR ===== -->
  <div class="sidebar">
    <img src="images/gms-logo.png" class="logo">

    <nav>
      <a href="index.html" class="active">▦<div>Dashboard</div></a>
      <a href="engine.html">⚙️<div>Engine</div></a>
      <a href="history.html">🗒️<div>History</div></a>
      <a href="maintenance.html">🗒️<div>Maintenance</div></a>
      <a href="alarm.html">🚨<div>Alarm</div></a>
      <a href="reports.html">🗒️<div>Report</div></a>
    </nav>
  </div>

  <!-- ===== HEADER BAR ===== -->
  <div class="topbar">
    <div class="topbar-title">Home</div>
    <div class="topbar-user" id="userarea">User</div>
  </div>

  <!-- ===== MAIN CONTENT ===== -->
  <div class="main-content">

    <!-- HERO -->
    <div class="hero">
      <div class="hero-content">
        <div id="clock" class="hero-time">--:--</div>
        <div class="hero-greeting">Welcome, User!</div>
        <div class="hero-quote">"Live Monitoring for Generator Health & Efficiency"</div>
      </div>
    </div>

    <!-- TOP 2 CARDS -->
    <div class="grid-2">

      <!-- ENGINE STATUS CARD -->
      <div class="card">
        <h3>Engine Status and Active Time</h3>
        <div>Kondisi: <span id="engSync" class="status-red">Not Sync</span></div>
        <div>Status: <span id="engStat" class="status-red">Inactive</span></div>
        <div style="margin-top:6px;">Today's total active time: <span id="engToday">0h 0m</span></div>
        <div style="margin-top:6px;">Last active: <span id="engLast">8h 20m</span></div>
      </div>

      <!-- RECENT ACTIVITY -->
      <div class="card">
        <h3>Recent Activity</h3>
        <div class="list-row"><span>Ganti Piston</span><span>11/8/2025</span></div>
        <div class="list-row"><span>Ganti Piston</span><span>10/15/2025</span></div>
        <div class="list-row"><span>Ganti Piston</span><span>10/15/2025</span></div>
      </div>
    </div>

    <!-- BOTTOM 2 CARDS -->
    <div class="grid-2" style="margin-top:26px;">

      <div class="card">
        <h3>Active Time History</h3>
        <div class="chart-box">
          <canvas id="chartActive"></canvas>
        </div>
      </div>

      <div class="card">
        <h3>Recent Alerts</h3>
        <div class="list-row"><span>MAP – <span style="color:#eab308">Below Lower Threshold</span></span><span>12/11/2025</span></div>
        <div class="list-row"><span>RPM – <span style="color:#e63946">Above Upper Threshold</span></span><span>12/11/2025</span></div>
      </div>

    </div>

  </div>

<script>
  /* USER DISPLAY */
  const user = localStorage.getItem("userRole") || "operator";
  document.getElementById("userarea").textContent = user;

  /* CLOCK */
  setInterval(() => {
    const now = new Date();
    document.getElementById("clock").textContent =
      now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }, 1000);

  /* CHART */
  const ctx = document.getElementById("chartActive");
  new Chart(ctx, {
    type:"line",
    data:{
      labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sunday"],
      datasets:[{
        data:[50,52,51,53,50,52,51],
        borderColor:"#1745a5",
        backgroundColor:"#1745a522",
        fill:true,
        tension:0.35
      }]
    },
    options:{plugins:{legend:{display:false}}, responsive:true}
  });
</script>

</body>
</html>
