import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { faker } from "@faker-js/faker";

export default function BookCSVEditor() {
  const [originalRows, setOriginalRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [editsMap, setEditsMap] = useState({});
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState(null);

  // CSV parser
  function parseCSVText(text) {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        complete: (results) => {
          const normalized = results.data.map((r) => ({
            Title: r.Title ?? "",
            Author: r.Author ?? "",
            Genre: r.Genre ?? "",
            PublishedYear: r.PublishedYear ?? "",
            ISBN: r.ISBN ?? "",
          }));
          resolve(normalized);
        },
        error: (err) => reject(err),
      });
    });
  }

  // Handle file upload
  const handleFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try {
      const text = await f.text();
      const parsed = await parseCSVText(text);
      setOriginalRows(parsed);
      setRows(parsed.map((r) => ({ ...r })));
      setEditsMap({});
      setPage(1);
      setMessage(`Loaded ${parsed.length} rows.`);
    } catch (err) {
      setMessage("Error parsing CSV.");
    } finally {
      setLoading(false);
    }
  };

  // Generate fake 10,000 rows
  const generateFakeData = (count = 10000) => {
    setLoading(true);
    setTimeout(() => {
      const gen = Array.from({ length: count }).map(() => ({
        Title: faker.lorem.words({ min: 2, max: 5 }),
        Author: `${faker.person.firstName()} ${faker.person.lastName()}`,
        Genre: faker.music.genre(),
        PublishedYear: String(
          faker.number.int({ min: 1850, max: new Date().getFullYear() })
        ),
        ISBN: faker.string.numeric(13),
      }));
      setOriginalRows(gen);
      setRows(gen.map((r) => ({ ...r })));
      setEditsMap({});
      setPage(1);
      setLoading(false);
      setMessage(`Generated ${count} fake rows.`);
    }, 50);
  };

  // Filtering + sorting
  const processedRows = useMemo(() => {
    let filtered = rows;
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      filtered = rows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const A = a[sortConfig.key] ?? "";
        const B = b[sortConfig.key] ?? "";
        if (!isNaN(Number(A)) && !isNaN(Number(B))) {
          return sortConfig.direction === "asc"
            ? Number(A) - Number(B)
            : Number(B) - Number(A);
        }
        return sortConfig.direction === "asc"
          ? String(A).localeCompare(String(B))
          : String(B).localeCompare(String(A));
      });
    }
    return filtered;
  }, [rows, filterText, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(processedRows.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [pageCount]);

  const currentPageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize]);

  // Editing
  const handleCellEdit = (globalIndex, field, value) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[globalIndex] = { ...copy[globalIndex], [field]: value };
      return copy;
    });
    setEditsMap((prev) => {
      const newMap = { ...prev };
      const original = originalRows[globalIndex] ?? {};
      if (!newMap[globalIndex]) newMap[globalIndex] = {};
      newMap[globalIndex][field] = value;
      if (String(value) === String(original[field] ?? "")) {
        delete newMap[globalIndex][field];
        if (Object.keys(newMap[globalIndex]).length === 0)
          delete newMap[globalIndex];
      }
      return newMap;
    });
  };

  // Download CSV
  const downloadCSV = () => {
    const header = ["Title", "Author", "Genre", "PublishedYear", "ISBN"];
    const csv = [header.join(",")];
    for (const r of rows) {
      const line = header.map((h) => {
        const val = r[h] ?? "";
        if (
          String(val).includes(",") ||
          String(val).includes('"') ||
          String(val).includes("\n")
        ) {
          return '"' + String(val).replace(/"/g, '""') + '"';
        }
        return String(val);
      });
      csv.push(line.join(","));
    }
    const blob = new Blob([csv.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "books_edited.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Reset edits
  const resetAllEdits = () => {
    setRows(originalRows.map((r) => ({ ...r })));
    setEditsMap({});
    setMessage("All edits reverted.");
  };

  // Sort toggle
  const toggleSort = (key) => {
    setSortConfig((s) => {
      if (s.key === key) {
        return { key, direction: s.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getGlobalIndex = (item) => rows.indexOf(item);
  const isRowEdited = (globalIndex) => editsMap[globalIndex] !== undefined;

  return (
    <div>
      <h1>Book CSV Editor</h1>

      {/* Controls */}
      <div className="controls">
        <label className="btn-upload">
          Upload CSV
          <input type="file" accept=".csv" onChange={handleFileUpload} hidden />
        </label>
        <button onClick={() => generateFakeData(10000)}>
          Generate 10,000 rows
        </button>
        <button onClick={downloadCSV} disabled={rows.length === 0}>
          Download CSV
        </button>
        <button onClick={resetAllEdits} disabled={rows.length === 0}>
          Reset
        </button>
        <input
          placeholder="Filter..."
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div style={{ marginBottom: "10px" }}>
        {loading
          ? "Loading..."
          : rows.length > 0
          ? `Rows: ${rows.length} · Filtered: ${processedRows.length} · Page ${page}/${pageCount}`
          : "No data yet"}
      </div>
      {message && <div style={{ color: "blue" }}>{message}</div>}

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #ddd" }}>
        <table>
          <thead>
            <tr>
              {["Title", "Author", "Genre", "PublishedYear", "ISBN"].map(
                (col) => (
                  <th key={col} onClick={() => toggleSort(col)}>
                    {col} {sortConfig.key === col && `(${sortConfig.direction})`}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {currentPageRows.map((r) => {
              const globalIndex = getGlobalIndex(r);
              const edited = isRowEdited(globalIndex);
              return (
                <tr key={globalIndex} className={edited ? "edited" : ""}>
                  {["Title", "Author", "Genre", "PublishedYear", "ISBN"].map(
                    (col) => (
                      <td key={col}>
                        <input
                          value={r[col] ?? ""}
                          onChange={(e) =>
                            handleCellEdit(globalIndex, col, e.target.value)
                          }
                          className={
                            editsMap[globalIndex]?.[col] !== undefined
                              ? "edited"
                              : ""
                          }
                        />
                      </td>
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button onClick={() => setPage(1)} disabled={page === 1}>
          « First
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ‹ Prev
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page === pageCount}
        >
          Next ›
        </button>
        <button
          onClick={() => setPage(pageCount)}
          disabled={page === pageCount}
        >
          Last »
        </button>
      </div>
    </div>
  );
}
