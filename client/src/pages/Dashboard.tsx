import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axiosServer from "../utilities/AxiosServer";
import dayjs from "dayjs";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer as RechartsResponsiveContainer } from "recharts";

// --- INTERFACES ---

interface SlmonStatus {
  type: "Feature";
  properties: {
    sta: string;
    latency1?: string;
    latency2?: string;
    latency3?: string;
    latency4?: string;
    latency5?: string;
    latency6?: string;
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
    color5?: string;
    color6?: string;
  };
  geometry: {
    type: "Point";
    coordinates: [string, string, number];
  };
}

interface SlmonFeatureCollection {
  type: "FeatureCollection";
  features: SlmonStatus[];
}

interface QCSummary {
  date: string;
  code: string;
  quality_percentage: number | null;
  result: string;
  site_quality: string | null;
  details: string;
  network: string;
  geometry: {
    type: string;
    coordinates: [number, number, number];
  };
  latencyStrings: string[];
  primaryLatency: number | null;
  primaryColor: string;
}

interface StackedBarData {
  date: string;
  ON: number;
  OFF: number;
}

const triangleIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 12px solid ${color}; position: relative;"><div style="position: absolute; left: -7px; top: -1px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 14px solid #222; z-index: -1;"></div></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 14],
  });

const getStatusTextEn = (result: string): string => {
  switch (result) {
    case "Baik": return "Good";
    case "Cukup Baik": return "Fair";
    case "Buruk": return "Bad";
    case "No Data": return "No Data";
    case "Mati": return "Mati";
    default: return result;
  }
};

const parseLatencyToSeconds = (latencyString?: string | null): number | null => {
  if (!latencyString || latencyString.toUpperCase() === "NA") return null;
  const value = parseFloat(latencyString);
  if (isNaN(value)) return null;

  if (latencyString.endsWith("h")) return value * 3600; 

  if (latencyString.endsWith("d")) return value * 86400;
  if (latencyString.endsWith("m")) return value * 60;
  
  return value; // Anggap sebagai detik jika tidak ada satuan
};

// Fungsi ini menentukan warna segitiga di peta berdasarkan aturan baru.
const getTriangleColor = (station: QCSummary): string => {
  // Ambil dan parse latency 1, 2, dan 3
  const latenciesInSeconds = [
    parseLatencyToSeconds(station.latencyStrings[0]),
    parseLatencyToSeconds(station.latencyStrings[1]),
    parseLatencyToSeconds(station.latencyStrings[2]),
  ];

  // Saring untuk mendapatkan nilai latensi yang valid (bukan null)
  const validLatencies = latenciesInSeconds.filter(
    (sec): sec is number => sec !== null
  );

  // Aturan 1: Hitam jika latency1 adalah "NA"
  if (station.latencyStrings[0]?.toUpperCase() === "NA" || validLatencies.length === 0) {
    return "#222222"; // Black
  }

  // Cari nilai terkecil dari latensi yang valid
  const minLatencySec = Math.min(...validLatencies);

  // Aturan 2: Hitam jika latensi terkecil >= 1 hari
  if (minLatencySec >= 86400) return "#222222"; // Black
  // Aturan 3: Hijau jika < 10 detik
  if (minLatencySec < 10) return "#16a34a"; // Green
  // Aturan 4: Kuning jika < 1 menit
  if (minLatencySec < 60) return "#facc15"; // Yellow
  // Aturan 5: Oranye jika < 3 menit
  if (minLatencySec < 180) return "#fb923c"; // Orange
  // Aturan 6: Merah jika < 30 menit
  if (minLatencySec < 1800) return "#ef4444"; // Red
  
  // Default: Abu-abu jika >= 30 menit dan < 1 hari
  return "#979797"; // Gray
};

// Komponen legend yang telah disinkronkan dengan logika warna baru.
const MapLegend = ({ stationData, totalStationCount }: { stationData: QCSummary[]; totalStationCount: number }) => {
  const countByCategory = {
    "<10s": 0,    // Green
    "<1m": 0,     // Yellow
    "<3m": 0,     // Orange
    "<30m": 0,    // Red
    "<1d": 0,     // Gray
    ">1d/NA": 0, // Black
  };

  // Logika penghitungan disesuaikan dengan aturan baru
  stationData.forEach((s) => {
    const latenciesInSeconds = [
      parseLatencyToSeconds(s.latencyStrings[0]),
      parseLatencyToSeconds(s.latencyStrings[1]),
      parseLatencyToSeconds(s.latencyStrings[2]),
    ];
    const validLatencies = latenciesInSeconds.filter((sec): sec is number => sec !== null);

    if (s.latencyStrings[0]?.toUpperCase() === "NA" || validLatencies.length === 0) {
      countByCategory[">1d/NA"]++;
      return;
    }

    const minLatencySec = Math.min(...validLatencies);

    if (minLatencySec >= 86400) {
      countByCategory[">1d/NA"]++;
    } else if (minLatencySec < 10) {
      countByCategory["<10s"]++;
    } else if (minLatencySec < 60) {
      countByCategory["<1m"]++;
    } else if (minLatencySec < 180) {
      countByCategory["<3m"]++;
    } else if (minLatencySec < 1800) {
      countByCategory["<30m"]++;
    } else {
      countByCategory["<1d"]++;
    }
  });

  const summary = [
    { label: "<10s", color: "bg-green-500", textColor: "text-green-600", count: countByCategory["<10s"] },
    { label: "<1m", color: "bg-yellow-400", textColor: "text-yellow-500", count: countByCategory["<1m"] },
    { label: "<3m", color: "bg-orange-400", textColor: "text-orange-500", count: countByCategory["<3m"] },
    { label: "<30m", color: "bg-red-500", textColor: "text-red-600", count: countByCategory["<30m"] },
    { label: "<1d", color: "bg-gray-400", textColor: "text-gray-500", count: countByCategory["<1d"] },
    { label: "≥1d/NA", color: "bg-black", textColor: "text-black", count: countByCategory[">1d/NA"] },
  ];

  const maxCount = Math.max(...summary.map((s) => s.count), 1);

  return (
    <div className="absolute bottom-3 left-3 bg-white/70 p-2 rounded-lg shadow w-44" style={{ fontSize: "11px" }}>
      <div className="font-semibold text-gray-800 mb-0.5" style={{ fontSize: "12px" }}>Latency Summary</div>
      <div className="mb-1 text-[10px]">
        <span className="font-bold">Total:</span> {totalStationCount}
      </div>
      <div className="flex flex-col gap-1">
        {summary.map((item) => (
          <div key={item.label} className="grid grid-cols-[2.5rem_1fr_1.5rem] items-center gap-x-1">
            <span className="text-[10px] text-gray-600 font-medium">{item.label}</span>
            <div
              className={`${item.color} h-2 rounded-sm`}
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                minWidth: item.count > 0 ? "3px" : "0",
                transition: "width 0.3s ease-in-out",
              }}
            ></div>
            <span className={`text-[11px] font-bold justify-self-start ${item.textColor}`}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};


const InfoCard = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="bg-white rounded-xl shadow p-3 min-h-[240px] flex flex-col border border-transparent">
    {/* Judul diperkecil padding & jarak agar rapi seperti kartu OPERATIONAL */}
    <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-0 mb-2">
      {title}
    </h2>
    <div className="flex-grow flex flex-col items-center justify-center w-full">
      {children ? children : <p>Konten untuk {title} akan ditampilkan di sini.</p>}
    </div>
  </div>
);

const MetadataCard = () => {
  // Tipe data sekarang adalah array of objects
  const [recentUpdates, setRecentUpdates] = useState<{ kode_stasiun: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentUpdates = async () => {
      try {
        setIsLoading(true);
        const response = await axiosServer.get('/api/stasiun/recent-updates');
        
        if (response.data.success && Array.isArray(response.data.data)) {
          setRecentUpdates(response.data.data);
        } else {
          console.error("Failed to fetch recent updates");
          setRecentUpdates([]);
        }
      } catch (error) {
        console.error("Error fetching recent updates:", error);
        setRecentUpdates([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentUpdates();
  }, []);

  // <<< PINDAHKAN LOGIKA RENDER KE DALAM SINI >>>
  return (
    <InfoCard title="Metadata">
      <div className="text-left text-gray-800 w-full text-xs">
        <p className="font-semibold mb-1">Recent updates:</p>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            {/* Kita akan tambahkan Loader2 di Langkah 3 */}
            <p>Loading...</p> 
          </div>
        ) : (
          <ul className="list-disc list-inside">
            {recentUpdates.length > 0 ? (
              recentUpdates.map((station) => (
                <li key={station.kode_stasiun}>{station.kode_stasiun}</li>
              ))
            ) : (
              <li className="list-none italic text-gray-500">No recent updates.</li>
            )}
          </ul>
        )}
      </div>
    </InfoCard>
  );
};

const AVAILABILITY_COLORS = ["#16a34a", "#facc15", "#fb923c", "#ef4444", "#a3a3a3"];

const getAvailabilityCategory = (value: number | null) => {
  if (value === null) return "No Data";
  if (value >= 97) return ">97%";
  if (value >= 90) return "90-97%";
  if (value > 0) return "1-89%";
  if (value === 0) return "0%";
  return "No Data";
};

const QUALITY_COLORS = ["#16a34a", "#fb923c", "#ef4444", "#a3a3a3"];
const QUALITY_LABELS = [
  { label: "GOOD", color: "#16a34a" },
  { label: "FAIR", color: "#fb923c" },
  { label: "POOR", color: "#ef4444" },
  { label: "NO DATA", color: "#a3a3a3" },
];

const Dashboard = () => {
  const [combinedData, setCombinedData] = useState<QCSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStationCount, setTotalStationCount] = useState<number>(0);
  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const [inactiveCount, setInactiveCount] = useState<number>(0);
  const [stackedBarData, setStackedBarData] = useState<StackedBarData[]>([]);

  // 1. Logika fetch data utama dibungkus dalam satu fungsi
  const fetchData = async () => {
    try {
      const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      const [qcResponse, slmonResponse, stasiunResponse] = await Promise.all([
        axiosServer.get<Omit<QCSummary, "latencyStrings" | "primaryLatency" | "primaryColor">[]>(`/api/qc/summary/${yesterday}`),
        axiosServer.get<SlmonFeatureCollection>("/api/dashboard/slmon/laststatus"),
        axiosServer.get<any[]>("/api/stasiun"),
      ]);

      setTotalStationCount(slmonResponse.data.features.length);
      const stasiunData = stasiunResponse.data || [];
      // Registered dihitung berdasarkan status "aktif"
      setRegisteredCount(stasiunData.filter((s) => s.status === "aktif").length);
      setInactiveCount(stasiunData.filter((s) => s.status === "nonaktif").length);

      const qcData = qcResponse.data;
      const slmonData = slmonResponse.data.features;
      const slmonMap = new Map(slmonData.map((item) => [item.properties.sta, item]));

      const finalData = qcData.map((station) => {
        const slmonStation = slmonMap.get(station.code);
        const allLatencyStrings: string[] = [];
        
        if (slmonStation) {
          for (let i = 1; i <= 6; i++) {
            const latencyKey = `latency${i}` as keyof typeof slmonStation.properties;
            const latencyValue = slmonStation.properties[latencyKey] || "N/A";
            allLatencyStrings.push(latencyValue);
          }
        }

        return {
          ...station,
          latencyStrings: allLatencyStrings,
          primaryLatency: null,
          primaryColor: '',
        };
      });

      setCombinedData(finalData);
    } catch (err) {
      console.error("Gagal memuat atau menggabungkan data:", err);
    } finally {
      // Hanya set isLoading ke false pada pemanggilan pertama kali
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  //useEffect untuk polling data utama
  useEffect(() => {
    const POLL_BASE = 10000; // 10s base
    const POLL_MAX = 60000; // 60s max backoff
    let failures = 0;
    let isFetching = false;
    let timerId: number | null = null;

    const scheduleNext = (delay: number) => {
      if (timerId) window.clearTimeout(timerId);
      timerId = window.setTimeout(runFetch, delay);
    };

    const runFetch = async () => {
      if (document.hidden) return scheduleNext(POLL_BASE); // pause when tab hidden
      if (isFetching) return; // avoid overlap
      isFetching = true;
      try {
        await fetchData();
        failures = 0;
        scheduleNext(POLL_BASE);
      } catch (err) {
        failures++;
        const nextDelay = Math.min(POLL_BASE * Math.pow(2, failures - 1), POLL_MAX);
        console.warn('fetchData failed, backing off to', nextDelay, err);
        scheduleNext(nextDelay);
      } finally {
        isFetching = false;
      }
    };

    // start immediately
    runFetch();

    // when tab becomes visible, fetch immediately
    const onVis = () => {
      if (!document.hidden) runFetch();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (timerId) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []); // run once on mount

  useEffect(() => {
    const fetchStackedBarData = async () => {
      try {
        const res = await axiosServer.get<StackedBarData[]>('/api/latency/history/7days');
        const formattedData = res.data.map(item => ({
          ...item,
          date: dayjs(item.date).format('DD MMM')
        }));
        setStackedBarData(formattedData);
      } catch (error) {
        console.error('Gagal mengambil data untuk stacked bar chart:', error);
      }
    };
    
    fetchStackedBarData();
  }, []);

  // --- PERBAIKAN LOGIKA ON/OFF ---
  const totalOff = combinedData.filter(s => getTriangleColor(s) === "#222222").length;
  const totalOn = combinedData.length - totalOff;

  const goodCount = combinedData.filter((s) => s.result === "Baik").length;
  const fairCount = combinedData.filter((s) => s.result === "Cukup Baik").length;
  const poorCount = combinedData.filter((s) => s.result === "Buruk").length;
  const noDataCount = combinedData.filter((s) => s.result === "No Data" || s.result === "Mati").length;

  const [availabilityPieData, setAvailabilityPieData] = useState<{ name: string; value: number }[]>([]);
  // useEffect untuk data Availability
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
        const res = await axiosServer.get(`/api/availability`, {
          params: { start_date: yesterday, end_date: yesterday },
        });
        const apiData = res.data?.data || {};
        const allAvail: number[] = [];
        Object.values(apiData).forEach((arr: any) => {
          if (Array.isArray(arr) && arr.length > 0) {
            const avail = arr[0]?.availability;
            if (typeof avail === "number") allAvail.push(avail);
          }
        });
        const categories = { ">97%": 0, "90-97%": 0, "1-89%": 0, "0%": 0, "No Data": 0 };
        allAvail.forEach((val) => {
          const cat = getAvailabilityCategory(val);
          categories[cat] = (categories[cat] || 0) + 1;
        });
        const totalStations = Object.keys(apiData).length;
        const counted = categories[">97%"] + categories["90-97%"] + categories["1-89%"] + categories["0%"];
        categories["No Data"] = totalStations - counted;
        setAvailabilityPieData(
          Object.entries(categories)
            .filter(([_, v]) => v > 0)
            .map(([name, value]) => ({ name, value }))
        );
      } catch (err) {
        setAvailabilityPieData([]);
      }
    };
    fetchAvailability();
  }, []);

  const [qualityPieData, setQualityPieData] = useState<{ name: string; value: number }[]>([]);
  // useEffect untuk data Quality 
  useEffect(() => {
    const fetchQuality = async () => {
      try {
        const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
        const res = await axiosServer.get(`/api/qc/summary/${yesterday}`);
        let good = 0, fair = 0, poor = 0, nodata = 0;
        (res.data || []).forEach((item: any) => {
          if (item.result === "Baik") good++;
          else if (item.result === "Cukup Baik") fair++;
          else if (item.result === "Buruk") poor++;
          else nodata++;
        });
        setQualityPieData([
          { name: "GOOD", value: good },
          { name: "FAIR", value: fair },
          { name: "POOR", value: poor },
          { name: "NO DATA", value: nodata },
        ]);
      } catch {
        setQualityPieData([]);
      }
    };
    fetchQuality();
  }, []);

  return (
    <MainLayout>
      <h1 className="text-left text-2xl font-bold mt-0 mb-2 ml-1">Dashboard</h1>
      <div className="flex flex-col lg:flex-row gap-3">
        {/* BAGIAN KIRI: PETA */}
        <div className="lg:w-2/3 w-full">
          <div className="bg-white rounded-lg shadow p-1 h-[395px]">
            <div className="relative w-full h-full px-2 pb-2 pt-1">
              <MapContainer
                center={[-2.5, 118]}
                zoom={5}
                className="w-full h-full rounded-md"
                style={{ minHeight: 375, maxHeight: 393, margin: "0.06rem" }}
              >
                <TileLayer attribution='&copy; <a href="https://osm.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {combinedData.map((s, idx) => (
                  <Marker
                    key={idx}
                    position={[s.geometry.coordinates[1], s.geometry.coordinates[0]]}
                    icon={triangleIcon(getTriangleColor(s))}
                  >
                    <Popup>
                      <b>Stasiun: {s.code}</b>
                      <br />
                      Status: {getStatusTextEn(s.result)}
                      <br />
                      {s.quality_percentage !== null && `Kualitas: ${s.quality_percentage.toFixed(1)}%`}
                      <br />
                      {s.latencyStrings && s.latencyStrings.length > 0 ? (
                        <span>Latencies: {s.latencyStrings.join(", ")}</span>
                      ) : (
                        <span>Latency: No data</span>
                      )}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              <MapLegend stationData={combinedData} totalStationCount={totalStationCount} />
            </div>
          </div>
        </div>

        {/* BAGIAN KANAN: STATUS & STACKED BAR */}
        <div className="lg:w-1/3 w-full flex flex-col gap-2">
          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded p-2 text-center border border-gray-300 shadow">
              <p className="text-xs font-semibold text-gray-600">REGISTERED</p>
              <p className="text-2xl font-bold">{isLoading ? "..." : registeredCount}</p>
            </div>
            <div className="bg-white rounded p-2 text-center border border-gray-300 shadow">
              <p className="text-xs font-semibold text-gray-600">INACTIVE</p>
              <p className="text-2xl font-bold">{isLoading ? "..." : inactiveCount}</p>
            </div>
          </div>
          <div className="bg-white rounded p-2 text-center border border-gray-300 shadow">
            <p className="text-xs font-semibold text-gray-600">OPERATIONAL</p>
            <p className="text-3xl font-bold mb-1">{isLoading ? "..." : combinedData.length}</p>
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-green-600 text-white rounded p-1">
                <p className="text-[10px] font-bold">ON</p>
                <p className="text-lg font-bold">{isLoading ? "..." : totalOn}</p>
              </div>
              <div className="bg-black text-white rounded p-1">
                <p className="text-[10px] font-bold">OFF</p>
                <p className="text-lg font-bold">{isLoading ? "..." : totalOff}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-white text-[10px] font-bold">
            <div className="bg-green-500 rounded p-1">
              <p>GOOD</p>
              <p className="text-base">{goodCount}</p>
            </div>
            <div className="bg-orange-400 rounded p-1">
              <p>FAIR</p>
              <p className="text-base">{fairCount}</p>
            </div>
            <div className="bg-red-600 rounded p-1">
              <p>POOR</p>
              <p className="text-base">{poorCount}</p>
            </div>
            <div className="bg-gray-400 rounded p-1">
              <p>NO DATA</p>
              <p className="text-base">{noDataCount}</p>
            </div>
          </div>
          {/* STACKED BAR CHART: ON/OFF 7 HARI */}
          <div className="bg-white rounded p-2 mt-2 flex flex-col items-center border border-gray-300 shadow" style={{ minHeight: 120 }}>
            <h2 className="text-xs font-bold mb-1 text-gray-700">Stasiun ON/OFF 7 Hari Terakhir</h2>
            <RechartsResponsiveContainer width="100%" height={90}>
              <BarChart data={stackedBarData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <RechartsTooltip />
                <Legend verticalAlign="top" height={20} />
                <Bar dataKey="ON" stackId="a" fill="#16a34a" name="ON" />
                <Bar dataKey="OFF" stackId="a" fill="#ef4444" name="OFF" />
              </BarChart>
            </RechartsResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- AVAILABILITY & QUALITY CARD & PIECHART --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        {/* Availability Card */}
        <InfoCard title="Availability">
          <div className="w-full flex flex-col items-center justify-center">
            <div className="w-full h-32 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={availabilityPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={40}
                    label
                  >
                    {availabilityPieData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={AVAILABILITY_COLORS[idx % AVAILABILITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {[ 
                { label: ">97%", color: "#16a34a" }, { label: "90-97%", color: "#facc15" },
                { label: "1-89%", color: "#fb923c" }, { label: "0%", color: "#ef4444" },
                { label: "No Data", color: "#a3a3a3" },
              ].map((item) => (
                <div key={item.label} className="flex items-center space-x-1 text-[11px]">
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: "0.45em",   
                      height: "0.45em",  
                      backgroundColor: item.color,
                      marginRight: "0.2em", 
                    }}
                  />
                  <span className="font-medium">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-[10px] text-gray-500">Data for yesterday's availability</span>
              <Link to="/station-availability" className="text-[10px] text-blue-600 hover:underline">
                Details...
              </Link>
            </div>
          </div>
        </InfoCard>

        {/* Quality Card */}
        <InfoCard title="Quality">
          <div className="w-full flex flex-col items-center justify-center">
            <div className="w-full h-35 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualityPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={40}
                    label
                  >
                    {qualityPieData.map((_, idx) => (
                      <Cell key={`cell-q-${idx}`} fill={QUALITY_COLORS[idx % QUALITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {QUALITY_LABELS.map((item) => (
                <div key={item.label} className="flex items-center space-x-1 text-[11px]">
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: "0.45em",   
                      height: "0.45em",  
                      backgroundColor: item.color,
                      marginRight: "0.2em", 
                    }}
                  />
                  <span className="font-medium">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-[10px] text-gray-500">Data for yesterday's quality</span>
              <Link to="/station-quality" className="text-[10px] text-blue-600 hover:underline">
                Details...
              </Link>
            </div>
          </div>
        </InfoCard>
        <MetadataCard />
      </div>
    </MainLayout>
  );
};

export default Dashboard;