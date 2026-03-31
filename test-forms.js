import { appRouter } from './server/routers.js';
import { createEmployeeContext } from './server/_core/trpc.js';

// Test Daily Field Report with date and time
async function testDailyReport() {
  console.log('Testing Daily Field Report...');
  const ctx = createEmployeeContext();
  const caller = appRouter.createCaller(ctx);

  const result = await caller.dailyReport.create({
    jobNo: "TEST-001",
    permitNo: "PERMIT-001",
    irNo: "IR-001",
    projectName: "Test Project",
    client: "Test Client",
    location: "Test Location",
    contractor: "Test Contractor",
    reviewedBy: "Test Reviewer",
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    time: "14:30", // 2:30 PM
    weather: "Sunny",
    inspectionTypes: ["Concrete"],
    workConformance: "met",
    materialSampling: "performed",
    notes: "Test report with time field",
    ccProjectArchitect: false,
    ccStructuralEngineer: false,
    ccContractor: true,
    ccOwner: false,
    ccProjectManager: false,
  });

  console.log('Daily Report Result:', result);

  if (result.success) {
    // Test PDF generation
    const pdfResult = await caller.dailyReport.generatePDF(result.data.id);
    console.log('PDF Generated:', pdfResult.success);
  }
}

// Test Concrete Test with date and time
async function testConcreteTest() {
  console.log('Testing Concrete Test...');
  const ctx = createEmployeeContext();
  const caller = appRouter.createCaller(ctx);

  const result = await caller.concreteTest.create({
    permitNo: "PERMIT-001",
    fileNo: "FILE-001",
    meiProjectNoName: "TEST-001 Test Project",
    contractor: "Test Contractor",
    subContractor: "Sub Contractor",
    buildingNo: "B-1",
    floorDeck: "Level 1",
    other: "",
    specificLocation: "Test Location",
    footing: false,
    postTension: false,
    masonryWall: false,
    columns: true,
    walls: false,
    masonryColumns: false,
    slabOnGrade: false,
    beams: false,
    masonryPrisms: false,
    supplier: "Test Supplier",
    material: "Ready Mix",
    sampledBy: "Test Inspector",
    ticketNo: "TKT-001",
    dateSampled: new Date().toISOString().split('T')[0],
    time: "15:45", // 3:45 PM
    loadNo: "L-001",
    dateReceived: new Date().toISOString().split('T')[0],
    setNo: "S-001",
    truckNo: "T-42",
    weather: "Sunny",
    mixDesignNo: "MIX-001",
    cementFactorSkCy: "5.5",
    maxSizeAggIn: "1.5",
    admixture: "None",
    specifiedStrengthPsi: "3000",
    slumpInSpecified: "4",
    slumpInMeasured: "4",
    mixTempFSpecified: "70",
    mixTempFMeasured: "72",
    airTempFSpecified: "75",
    airTempFMeasured: "76",
    airContentSpecified: "6",
    airContentMeasured: "6.2",
    specimens: Array(7).fill({
      specimenNo: "",
      setNo: "",
      agedDays: "",
      dateTested: "",
      dimensions: "",
      areaSquareIn: "",
      ultimateLoadLbs: "",
      compressiveStrengthPsi: "",
      averageStrengthPsi: "",
      labTechnician: "",
      labManager: "",
    }),
    comments: "Test concrete test with time field",
  });

  console.log('Concrete Test Result:', result);

  if (result.success) {
    // Test PDF generation
    const pdfResult = await caller.concreteTest.generatePDF(result.data.id);
    console.log('PDF Generated:', pdfResult.success);
  }
}

// Run tests
async function runTests() {
  try {
    await testDailyReport();
    await testConcreteTest();
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();