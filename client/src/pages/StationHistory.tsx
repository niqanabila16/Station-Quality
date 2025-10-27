import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import axiosServer from "../utilities/AxiosServer";
import { ChevronLeft, Eye, Upload, Download, RefreshCw } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import DataTable from "../components/DataTable";

interface StationHistory {
  history_id: number;
  stasiun_id: number;
  kode_stasiun: string;
  net: string;
  channel: string | null;
  digitizer_name: string | null;
  total_gain: number | null;
  input_unit: string | null;
  sampling_rate: number | null;
  sensor_name: string | null;
  start_date: string | null;
  end_date: string | null;
  paz: object | null; // JSON data - lowercase to match backend response
  status: boolean;
  created_at: string;
  response_path: string | null;
}

const StationHistory = () => {
  const { stationCode } = useParams<{ stationCode: string }>();
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState<StationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedInstrument, setSelectedInstrument] = useState<StationHistory | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPAZ, setSelectedPAZ] = useState<StationHistory | null>(null);
  const [showPAZModal, setShowPAZModal] = useState(false);
  const [instrumentImages, setInstrumentImages] = useState<Record<number, string>>({});
  const [stationId, setStationId] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleShowInstrumentDetail = (instrument: StationHistory) => {
    setSelectedInstrument(instrument);
    setShowModal(true);
    // Fetch image URL if not already cached
    if (instrument.response_path && !instrumentImages[instrument.history_id]) {
      fetchInstrumentImage(instrument.history_id);
    }
  };

  const handleShowPAZDetail = (instrument: StationHistory) => {
    setSelectedPAZ(instrument);
    setShowPAZModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedInstrument(null);
  };

  const closePAZModal = () => {
    setShowPAZModal(false);
    setSelectedPAZ(null);
  };

  const downloadInstrumentImage = async (instrument: StationHistory) => {
    if (!instrument.response_path) {
      alert('No image available for download');
      return;
    }

    // Get the image URL from cache or fetch it
    let imageUrl = instrumentImages[instrument.history_id];
    if (!imageUrl) {
      imageUrl = await fetchInstrumentImage(instrument.history_id);
    }

    if (!imageUrl) {
      alert('Failed to load image for download');
      return;
    }

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `instrument_${instrument.kode_stasiun}_${instrument.channel}_${new Date().toISOString().split('T')[0]}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchInstrumentImage = useCallback(async (historyId: number) => {
    try {
      const response = await axiosServer.get(`/api/station-history/${historyId}/response`);
      if (response.data.success && response.data.data) {
        setInstrumentImages(prev => ({
          ...prev,
          [historyId]: response.data.data
        }));
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching instrument image:', error);
    }
    return null;
  }, []);

  // Column definitions for DataTable
  const columns: ColumnDef<StationHistory>[] = [
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ getValue }: { getValue: () => unknown }) => formatDate(getValue() as string),
      size: 150,
      enableSorting: false,
    },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ getValue }: { getValue: () => unknown }) => (getValue() as string | null) || "-",
      size: 100,
      enableSorting: false,
    },
    {
      accessorKey: "sensor_name",
      header: "Sensor Name",
      cell: ({ getValue }: { getValue: () => unknown }) => (getValue() as string | null) || "-",
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "digitizer_name",
      header: "Digitizer Name",
      cell: ({ getValue }: { getValue: () => unknown }) => (getValue() as string | null) || "-",
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "total_gain",
      header: "Total Gain",
      cell: ({ getValue }: { getValue: () => unknown }) => (getValue() as number | null) || "-",
      size: 100,
      enableSorting: false,
    },
    {
      accessorKey: "input_unit",
      header: "Input Unit",
      cell: ({ getValue }: { getValue: () => unknown }) => (getValue() as string | null) || "-",
      size: 100,
      enableSorting: false,
    },
    {
      accessorKey: "sampling_rate",
      header: "Sampling Rate",
      cell: ({ getValue }: { getValue: () => unknown }) => (getValue() as number | null) || "-",
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "start_date",
      header: "Start Date",
      cell: ({ getValue }: { getValue: () => unknown }) => formatDate(getValue() as string | null),
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "end_date",
      header: "End Date",
      cell: ({ getValue }: { getValue: () => unknown }) => formatDate(getValue() as string | null),
      size: 120,
      enableSorting: false,
    },
    {
      accessorKey: "paz",
      header: "PAZ",
      cell: ({ getValue, row }: { getValue: () => unknown, row: { original: StationHistory } }) => {
        const pazValue = getValue() as object | null;
        return pazValue ? (
          <button
            onClick={() => handleShowPAZDetail(row.original)}
            className="text-blue-600 hover:text-blue-800 underline text-sm"
            title="View PAZ JSON data"
          >
            View JSON
          </button>
        ) : (
          <span>-</span>
        );
      },
      size: 80,
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }: { getValue: () => unknown }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            getValue() as boolean
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {getValue() as boolean ? 'In Use' : 'Inactive'}
        </span>
      ),
      size: 100,
      enableSorting: false,
    },
    {
      id: "instrument_detail",
      header: "Instrument Detail",
      cell: ({ row }: { row: { original: StationHistory } }) => (
        <button
          onClick={() => handleShowInstrumentDetail(row.original)}
          className="inline-flex items-center gap-2 px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="View instrument image"
        >
          <Eye className="h-4 w-4" />
          View Image
        </button>
      ),
      size: 150,
      enableSorting: false,
    },
  ];

  const fetchStationHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      // No longer using refreshing state
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await axiosServer.get(`/api/station-history/bycode`, {
        params: { code: stationCode }
      });

      if (response.data.success) {
        setHistoryData(response.data.data);
        // Extract station_id from the first record if available
        if (response.data.data && response.data.data.length > 0) {
          const extractedStationId = response.data.data[0].stasiun_id;
          console.log('📍 Setting stationId from history data:', extractedStationId);
          setStationId(extractedStationId);
        } else {
          console.log('⚠️ No history data available to extract stationId');
        }
      } else {
        setError(response.data.message || 'Failed to fetch station history');
      }
    } catch (err) {
      console.error('Error fetching station history:', err);
      setError('Failed to load station history data');
    } finally {
      setLoading(false);
    }
  }, [stationCode, setError, setHistoryData, setLoading, setStationId]);

  const refreshData = useCallback(async () => {
    console.log('🔄 Refresh button clicked');
    await fetchStationHistory(true);
  }, [fetchStationHistory]);

  const updateStationHistory = useCallback(async () => {
    console.log('🔄 Update button clicked');
    console.log('📍 Station Code:', stationCode);

    let currentStationId = stationId;
    console.log('🆔 Current Station ID from state:', currentStationId);

    // If stationId is not available, try to get it from station code
    if (!currentStationId && stationCode) {
      console.log('🔍 Station ID not available, fetching from API...');
      try {
        // Make a request to get station info by code to get the ID
        const stationResponse = await axiosServer.get(`/api/stasiun/bycode`, {
          params: { code: stationCode }
        });
        console.log('📡 Station API Response:', stationResponse.data);

        if (stationResponse.data.success && stationResponse.data.data) {
          currentStationId = stationResponse.data.data.stasiun_id;
          console.log('✅ Retrieved Station ID:', currentStationId);
          setStationId(currentStationId); // Store it for future use
        } else {
          console.log('❌ No station data found in response');
        }
      } catch (err) {
        console.error('❌ Error fetching station ID:', err);
        setError('Failed to get station information for update');
        return;
      }
    }

    if (!currentStationId) {
      console.log('❌ No Station ID available for update');
      setError('Station ID not available for update');
      return;
    }

    console.log('🚀 Starting update process...');
    console.log('🆔 Final Station ID to use:', currentStationId);

    const updateUrl = `/api/station-history/station/${currentStationId}`;
    console.log('🌐 Update URL:', updateUrl);

    setUpdating(true);
    setError(null);

    try {
      console.log('📤 Sending PUT request...');
      const response = await axiosServer.put(updateUrl);
      console.log('📥 Update API Response:', response.data);

      if (response.data.success) {
        console.log('✅ Update successful');
        // Refresh data asynchronously after successful update
        setTimeout(() => {
          refreshData();
        }, 100);
      } else {
        console.log('⚠️ Update API returned success=false:', response.data.message);
        setError(response.data.message || 'Failed to update station history');
      }
    } catch (err) {
      console.error('❌ Error during update:', err);
      console.log('🔍 Error object:', err);
      setError('Failed to update station history data');
    } finally {
      console.log('🏁 Update process completed');
      setUpdating(false);
    }
  }, [stationId, stationCode, refreshData]);

  useEffect(() => {
    fetchStationHistory();
  }, [fetchStationHistory]);

  // Get unique channels for filter
  const uniqueChannels = Array.from(new Set(historyData.map(item => item.channel).filter(Boolean))).sort();

  // Filter data based on selected channel
  const filteredData = selectedChannel === 'all' 
    ? historyData 
    : historyData.filter(item => item.channel === selectedChannel);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <MainLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading station history...</p>
            </div>
          </div>
        </MainLayout>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <MainLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MainLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ChevronLeft size={20} />
                Back
              </button>
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Station History: {stationCode}
                  </h1>
                  <p className="text-gray-600">
                    Complete equipment history and configuration changes for station {stationCode}
                  </p>
                </div>
                
                {/* Channel Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="channel-filter" className="text-sm font-medium text-gray-700">
                    Filter by Channel:
                  </label>
                  <select
                    id="channel-filter"
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="all">All Channels</option>
                    {uniqueChannels.map(channel => (
                      <option key={channel!} value={channel!}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Equipment History Records ({filteredData.length} entries)
                  {selectedChannel !== 'all' && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      - Filtered by Channel: {selectedChannel}
                    </span>
                  )}
                </h2>

                <div className="flex items-center gap-3">
                  <button
                    onClick={updateStationHistory}
                    disabled={loading || updating}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-md shadow-sm text-sm font-medium hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Update station history data from external service"
                  >
                    <Upload className={`h-4 w-4 ${updating ? 'animate-pulse' : ''}`} />
                    {updating ? 'Updating...' : 'Update'}
                  </button>

                  <button
                    onClick={refreshData}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh data from server"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              <DataTable
                columns={columns}
                data={filteredData}
                globalFilter=""
                setGlobalFilter={() => {}}
              />
            </div>
          </div>
        </div>

        {/* Instrument Detail Modal */}
        {showModal && selectedInstrument && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Instrument Image - {selectedInstrument.kode_stasiun} ({selectedInstrument.channel})
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Instrument Image */}
                <div className="flex justify-center">
                  <div className="border-2 border-gray-200 border-dashed rounded-lg p-4 max-w-lg">
                    <div className="text-center">
                      {selectedInstrument.response_path ? (
                        instrumentImages[selectedInstrument.history_id] ? (
                          <img
                            src={instrumentImages[selectedInstrument.history_id]}
                            alt={`Instrument Image - ${selectedInstrument.kode_stasiun} (${selectedInstrument.channel})`}
                            className="max-w-full h-auto max-h-96 mx-auto rounded-lg shadow-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/instruments/default.svg';
                              target.alt = 'Image not available - using default';
                            }}
                          />
                        ) : (
                          <div className="py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-sm text-gray-500">Loading image...</p>
                          </div>
                        )
                      ) : (
                        <div className="py-12">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="mt-2 text-sm text-gray-500">No image available</p>
                        </div>
                      )}
                      <p className="mt-2 text-sm text-gray-500">
                        {selectedInstrument.sensor_name || 'Instrument'} - {selectedInstrument.channel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  {selectedInstrument.response_path && (
                    <button
                      onClick={() => downloadInstrumentImage(selectedInstrument)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      title="Download instrument image"
                    >
                      <Download className="h-4 w-4" />
                      Download Image
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAZ JSON Modal */}
        {showPAZModal && selectedPAZ && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    PAZ Data - {selectedPAZ.kode_stasiun} ({selectedPAZ.channel})
                  </h3>
                  <button
                    onClick={closePAZModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* PAZ JSON Display */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">PAZ JSON Data:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedPAZ.paz, null, 2));
                        }}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => {
                          const dataStr = JSON.stringify(selectedPAZ.paz, null, 2);
                          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                          const exportFileDefaultName = `paz_${selectedPAZ.kode_stasiun}_${selectedPAZ.channel}_${new Date().toISOString().split('T')[0]}.json`;
                          
                          const linkElement = document.createElement('a');
                          linkElement.setAttribute('href', dataUri);
                          linkElement.setAttribute('download', exportFileDefaultName);
                          linkElement.click();
                        }}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        title="Download as JSON file"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-gray-800 bg-white p-3 rounded border overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(selectedPAZ.paz, null, 2)}
                  </pre>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={closePAZModal}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </MainLayout>
    </div>
  );
};

export default StationHistory;