import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Actor } from "@/lib/types";

// הוספת תמיכה בעברית ב-jsPDF
// נשתמש בפונט שתומך בעברית
const addHebrewFont = (doc: jsPDF) => {
  // jsPDF לא תומך בעברית out of the box, אז נשתמש ב-autoTable שיש לו תמיכה טובה יותר
  doc.setLanguage("he");
};

/**
 * ייצוא שחקן בודד ל-PDF
 */
export const exportActorToPDF = (actor: Actor) => {
  const doc = new jsPDF();
  addHebrewFont(doc);

  // כותרת
  doc.setFontSize(20);
  doc.text("Actor Profile", 105, 20, { align: "center" });

  // פרטי השחקן
  const currentYear = new Date().getFullYear();
  const age = currentYear - actor.birth_year;

  const data = [
    ["Full Name", actor.full_name],
    ["Gender", actor.gender === "male" ? "Male" : "Female"],
    ["Age", `${age} (Born ${actor.birth_year})`],
    ["Phone", actor.phone],
    ["Email", actor.email || "N/A"],
    ["City", actor.city || "N/A"],
    ["Singer", actor.is_singer ? "Yes" : "No"],
    ["Course Graduate", actor.is_course_grad ? "Yes" : "No"],
    ["VAT Status", actor.vat_status],
    [
      "Skills",
      actor.skills.length > 0 ? actor.skills.map((s) => s.label).join(", ") : "N/A",
    ],
    [
      "Languages",
      actor.languages.length > 0 ? actor.languages.map((l) => l.label).join(", ") : "N/A",
    ],
    ["Notes", actor.notes || "N/A"],
  ];

  autoTable(doc, {
    startY: 30,
    head: [["Field", "Value"]],
    body: data,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
    },
  });

  // שמירת הקובץ
  doc.save(`actor_${actor.full_name.replace(/\s+/g, "_")}.pdf`);
};

/**
 * ייצוא מספר שחקנים ל-PDF
 */
export const exportActorsToPDF = (actors: Actor[], filename: string = "actors") => {
  const doc = new jsPDF();
  addHebrewFont(doc);

  // כותרת
  doc.setFontSize(20);
  doc.text("Actors List", 105, 20, { align: "center" });

  // הכנת הנתונים
  const currentYear = new Date().getFullYear();
  const tableData = actors.map((actor) => [
    actor.full_name,
    actor.gender === "male" ? "M" : "F",
    `${currentYear - actor.birth_year}`,
    actor.phone,
    actor.email || "N/A",
    actor.is_singer ? "Yes" : "No",
    actor.vat_status,
  ]);

  autoTable(doc, {
    startY: 30,
    head: [["Name", "Gender", "Age", "Phone", "Email", "Singer", "VAT Status"]],
    body: tableData,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 15 },
      2: { cellWidth: 15 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: 15 },
      6: { cellWidth: 25 },
    },
  });

  // שמירת הקובץ
  doc.save(`${filename}.pdf`);
};

/**
 * ייצוא שחקן בודד ל-Excel
 */
export const exportActorToExcel = (actor: Actor) => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - actor.birth_year;

  const data = [
    { Field: "Full Name", Value: actor.full_name },
    { Field: "Gender", Value: actor.gender === "male" ? "Male" : "Female" },
    { Field: "Age", Value: `${age} (Born ${actor.birth_year})` },
    { Field: "Phone", Value: actor.phone },
    { Field: "Email", Value: actor.email || "N/A" },
    { Field: "City", Value: actor.city || "N/A" },
    { Field: "Singer", Value: actor.is_singer ? "Yes" : "No" },
    { Field: "Course Graduate", Value: actor.is_course_grad ? "Yes" : "No" },
    { Field: "VAT Status", Value: actor.vat_status },
    {
      Field: "Skills",
      Value: actor.skills.length > 0 ? actor.skills.map((s) => s.label).join(", ") : "N/A",
    },
    {
      Field: "Languages",
      Value: actor.languages.length > 0 ? actor.languages.map((l) => l.label).join(", ") : "N/A",
    },
    { Field: "Notes", Value: actor.notes || "N/A" },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Actor Profile");

  XLSX.writeFile(wb, `actor_${actor.full_name.replace(/\s+/g, "_")}.xlsx`);
};

/**
 * ייצוא מספר שחקנים ל-Excel
 */
export const exportActorsToExcel = (actors: Actor[], filename: string = "actors") => {
  const currentYear = new Date().getFullYear();

  const data = actors.map((actor) => ({
    "Full Name": actor.full_name,
    Gender: actor.gender === "male" ? "Male" : "Female",
    Age: currentYear - actor.birth_year,
    "Birth Year": actor.birth_year,
    Phone: actor.phone,
    Email: actor.email || "N/A",
    City: actor.city || "N/A",
    Singer: actor.is_singer ? "Yes" : "No",
    "Course Graduate": actor.is_course_grad ? "Yes" : "No",
    "VAT Status": actor.vat_status,
    Skills: actor.skills.length > 0 ? actor.skills.map((s) => s.label).join(", ") : "N/A",
    Languages: actor.languages.length > 0 ? actor.languages.map((l) => l.label).join(", ") : "N/A",
    Notes: actor.notes || "N/A",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Actors");

  // הגדרת רוחב עמודות
  const colWidths = [
    { wch: 25 }, // Full Name
    { wch: 10 }, // Gender
    { wch: 8 },  // Age
    { wch: 12 }, // Birth Year
    { wch: 15 }, // Phone
    { wch: 25 }, // Email
    { wch: 15 }, // City
    { wch: 10 }, // Singer
    { wch: 15 }, // Course Graduate
    { wch: 15 }, // VAT Status
    { wch: 30 }, // Skills
    { wch: 30 }, // Languages
    { wch: 40 }, // Notes
  ];
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * ייצוא שחקן בודד - בחירת פורמט
 */
export const exportActor = (actor: Actor, format: "pdf" | "excel") => {
  if (format === "pdf") {
    exportActorToPDF(actor);
  } else {
    exportActorToExcel(actor);
  }
};

/**
 * ייצוא מספר שחקנים - בחירת פורמט
 */
export const exportActors = (actors: Actor[], format: "pdf" | "excel", filename?: string) => {
  if (format === "pdf") {
    exportActorsToPDF(actors, filename);
  } else {
    exportActorsToExcel(actors, filename);
  }
};
