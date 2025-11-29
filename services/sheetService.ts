
import { MushroomBatch, BatchStatus, ApiResponse, InventoryItem, PurchaseOrder, SalesRecord, Customer, FinishedGood, SalesStatus, PaymentMethod, DailyCostMetrics, Supplier } from '../types';

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================
// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE TO SAVE PERMANENTLY
const DEFAULT_SCRIPT_URL = ''; 
// PASTE YOUR GOOGLE SHEET URL HERE TO SAVE PERMANENTLY
const DEFAULT_SHEET_URL = ''; 

const STORAGE_KEY_URL = 'shroomtrack_api_url';
const STORAGE_KEY_SHEET_URL = 'shroomtrack_sheet_url';
const STORAGE_KEY_MOCK = 'shroomtrack_use_mock';
const STORAGE_KEY_LABOR_RATE = 'shroomtrack_labor_rate';
const STORAGE_KEY_RAW_RATE = 'shroomtrack_raw_rate';

export const getAppSettings = () => {
  const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const storedSheetUrl = localStorage.getItem(STORAGE_KEY_SHEET_URL);
  const storedMock = localStorage.getItem(STORAGE_KEY_MOCK);
  
  return {
    scriptUrl: DEFAULT_SCRIPT_URL || storedUrl || '',
    sheetUrl: DEFAULT_SHEET_URL || storedSheetUrl || '',
    useMock: storedMock !== null ? storedMock === 'true' : (DEFAULT_SCRIPT_URL ? false : true),
  };
};

export const saveAppSettings = (url: string, sheetUrl: string, useMock: boolean) => {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_SHEET_URL, sheetUrl);
  localStorage.setItem(STORAGE_KEY_MOCK, String(useMock));
};

export const getLaborRate = (): number => {
    return parseFloat(localStorage.getItem(STORAGE_KEY_LABOR_RATE) || '12.50');
};

export const setLaborRate = (rate: number) => {
    localStorage.setItem(STORAGE_KEY_LABOR_RATE, rate.toString());
};

export const getRawMaterialRate = (): number => {
    return parseFloat(localStorage.getItem(STORAGE_KEY_RAW_RATE) || '8.00');
};

export const setRawMaterialRate = (rate: number) => {
    localStorage.setItem(STORAGE_KEY_RAW_RATE, rate.toString());
};

// ============================================================================
// MOCK DATA STORE (LOCAL SOURCE OF TRUTH)
// ============================================================================
let mockBatches: MushroomBatch[] = [
  {
    id: 'BATCH-1001',
    dateReceived: new Date().toISOString(),
    sourceFarm: 'Green Valley Farms',
    rawWeightKg: 50,
    spoiledWeightKg: 2,
    netWeightKg: 48,
    remainingWeightKg: 48, 
    status: BatchStatus.RECEIVED
  }
];

let mockFinishedGoods: FinishedGood[] = [];
let mockSuppliers: Supplier[] = [
  { id: 'sup-1', name: 'PackKing', address: '123 Industrial Ave', contact: 'sales@packking.com' },
  { id: 'sup-2', name: 'LabelMasters', address: '45 Design Way', contact: 'orders@labelmasters.com' }
];

let mockInventory: InventoryItem[] = [
  { id: 'inv-pouch', name: 'Vacuum Pouches (Std)', type: 'PACKAGING', subtype: 'POUCH', quantity: 500, threshold: 100, unit: 'packs', unitCost: 45.00, supplier: 'PackKing', packSize: 100 },
  { id: 'inv-sticker', name: 'Brand Stickers', type: 'LABEL', subtype: 'STICKER', quantity: 85, threshold: 200, unit: 'rolls', unitCost: 45.00, supplier: 'LabelMasters', packSize: 300 }, 
  { id: 'inv-tin', name: 'Metal Tins', type: 'PACKAGING', subtype: 'TIN', quantity: 200, threshold: 50, unit: 'sets', unitCost: 30.00, supplier: 'PackKing', packSize: 25 },
];

let mockPurchaseOrders: PurchaseOrder[] = [];
let mockCustomers: Customer[] = [];
let mockSales: SalesRecord[] = [];
// This now holds the full daily cost history (transactional)
let mockDailyCosts: DailyCostMetrics[] = [];

// Helper to log transactional cost
const recordCostTransaction = (
    referenceId: string, 
    rawCost: number, 
    wasteCost: number, 
    pkgCost: number, 
    laborCost: number,
    weightProcessed: number = 0,
    processingHours: number = 0
) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Create a new transaction row for every event (Batch by Batch)
    const newTransaction: DailyCostMetrics = {
        id: `COST-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        referenceId: referenceId, // Batch ID or PO ID
        date: today,
        weightProcessed: weightProcessed,
        processingHours: processingHours,
        rawMaterialCost: parseFloat(rawCost.toFixed(2)),
        packagingCost: parseFloat(pkgCost.toFixed(2)),
        wastageCost: parseFloat(wasteCost.toFixed(2)),
        laborCost: parseFloat(laborCost.toFixed(2)),
        totalCost: parseFloat((rawCost + pkgCost + wasteCost + laborCost).toFixed(2))
    };
    
    mockDailyCosts.unshift(newTransaction);
};

export const getLocalData = () => {
  return [...mockBatches];
};

// ============================================================================
// SYNC SERVICES (MANUAL PUSH/PULL)
// ============================================================================

export const pushFullDatabase = async (): Promise<ApiResponse<any>> => {
    const { scriptUrl, useMock } = getAppSettings();
    if (useMock || !scriptUrl) return { success: false, message: "No API URL configured" };

    const payload = {
        batches: mockBatches,
        inventory: mockInventory,
        finishedGoods: mockFinishedGoods,
        dailyCosts: mockDailyCosts
    };

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'SYNC_FULL_DB',
                payload: payload
            })
        });
        return { success: true, message: "Full database push sent." };
    } catch (e) {
        return { success: false, message: "Failed to push data." };
    }
};

export const pullFullDatabase = async (): Promise<ApiResponse<any>> => {
    const { scriptUrl, useMock } = getAppSettings();
    if (useMock || !scriptUrl) return { success: false, message: "No API URL configured" };

    try {
        const res = await fetch(`${scriptUrl}?action=GET_FULL_DB`);
        const json = await res.json();
        
        if (json.success && json.data) {
            // Overwrite local memory with remote data
            if (json.data.batches) mockBatches = json.data.batches;
            if (json.data.inventory) mockInventory = json.data.inventory;
            if (json.data.finishedGoods) mockFinishedGoods = json.data.finishedGoods;
            if (json.data.dailyCosts) mockDailyCosts = json.data.dailyCosts;
            
            return { success: true, message: "Data synced from sheet." };
        }
    } catch (e) {
        return { success: false, message: "Failed to pull data." };
    }
    return { success: false, message: "Unknown error" };
};


// ============================================================================
// BATCH SERVICES
// ============================================================================

export const fetchBatches = async (forceRemote = false): Promise<ApiResponse<MushroomBatch[]>> => {
  if (forceRemote) {
      await pullFullDatabase();
  }
  return { success: true, data: [...mockBatches] };
};

export const createBatch = async (
  farm: string, 
  rawWeight: number, 
  spoiledWeight: number
): Promise<ApiResponse<MushroomBatch>> => {
  const newId = `BATCH-${Math.floor(Math.random() * 10000)}`;
  const newBatch: MushroomBatch = {
    id: newId,
    dateReceived: new Date().toISOString(),
    sourceFarm: farm,
    rawWeightKg: rawWeight,
    spoiledWeightKg: spoiledWeight,
    netWeightKg: rawWeight - spoiledWeight,
    remainingWeightKg: rawWeight - spoiledWeight,
    status: BatchStatus.RECEIVED
  };
  mockBatches.unshift(newBatch);

  // AUTO LOG: Raw Material Cost + Receiving Wastage
  const rawRate = getRawMaterialRate();
  const rawCost = rawWeight * rawRate;
  
  recordCostTransaction(newId, rawCost, 0, 0, 0, rawWeight, 0);

  return { success: true, data: newBatch };
};

export const updateBatchStatus = async (
  id: string, 
  status: BatchStatus, 
  updates: Partial<MushroomBatch> = {}
): Promise<ApiResponse<MushroomBatch>> => {
  const index = mockBatches.findIndex(b => b.id === id);
  if (index === -1) return { success: false, message: "Batch not found" };
  
  let updatedBatch = { ...mockBatches[index], ...updates, status };
  
  // LOGIC: BATCH COMPLETION (Labor & Processing Waste)
  if (status === BatchStatus.DRYING_COMPLETE && updatedBatch.processConfig) {
      const startTime = updatedBatch.processConfig.startTime;
      const durationHours = (Date.now() - startTime) / (1000 * 60 * 60);
      
      const laborRate = getLaborRate();
      const laborCost = durationHours * laborRate;
      
      const processingWaste = updates.processingWastageKg || 0;
      const wasteCost = processingWaste * getRawMaterialRate();

      recordCostTransaction(
          id, 
          0, // Raw cost already logged at reception
          wasteCost, 
          0, 
          laborCost, 
          0, 
          parseFloat(durationHours.toFixed(2))
      );
  }

  if (status === BatchStatus.DRYING_COMPLETE && updates.processingWastageKg) {
      const currentNet = updatedBatch.netWeightKg;
      const wastage = updates.processingWastageKg || 0;
      updatedBatch.remainingWeightKg = Math.max(0, currentNet - wastage);
  }

  mockBatches[index] = updatedBatch;
  return { success: true, data: mockBatches[index] };
};

// ============================================================================
// HARVEST ALERTS
// ============================================================================
let mockAlerts = [
    { id: 'h-1', farmName: 'Hilltop Myco', species: 'White Oyster', estimatedWeightKg: 45.5, timestamp: new Date().toISOString() }
];

export const checkHarvestAlerts = async (): Promise<ApiResponse<any>> => {
  const { scriptUrl, useMock } = getAppSettings();
  if (useMock || !scriptUrl) return { success: true, data: mockAlerts };

  try {
    const response = await fetch(`${scriptUrl}?action=CHECK_ALERTS`);
    if (!response.ok) throw new Error("Network error");
    const json = await response.json();
    
    // If backend returns empty array, trust it. Only default to mock on ERROR.
    if (json.success) return json;
    
    return { success: false, message: "Failed to parse alerts" };
  } catch (error) {
    console.error("Alert fetch failed", error);
    return { success: true, data: mockAlerts }; // Fallback to mock only on network fail
  }
};

export const clearHarvestAlert = async (id: string): Promise<ApiResponse<any>> => {
  const { scriptUrl, useMock } = getAppSettings();
  mockAlerts = mockAlerts.filter(a => a.id !== id);
  
  if (useMock || !scriptUrl) return { success: true, message: "Alert cleared (Local)" };

  try {
    await fetch(scriptUrl, {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CLEAR_ALERT', payload: { id: id } })
    });
    return { success: true, message: "Alert cleared." };
  } catch (error) {
    return { success: true, message: "Alert cleared (Fallback)." };
  }
};

// ============================================================================
// PACKING SERVICES
// ============================================================================

export const packBatchPartial = async (
  batchId: string,
  weightToPack: number,
  packCount: number,
  packagingType: 'TIN' | 'POUCH',
  recipeName: string
): Promise<ApiResponse<FinishedGood>> => {
  const batchIndex = mockBatches.findIndex(b => b.id === batchId);
  if (batchIndex === -1) return { success: false, message: "Batch not found" };
  
  const batch = mockBatches[batchIndex];
  const currentRemaining = batch.remainingWeightKg !== undefined ? batch.remainingWeightKg : batch.netWeightKg;

  batch.remainingWeightKg = Math.max(0, currentRemaining - weightToPack);
  if (batch.remainingWeightKg < 0.1) {
    batch.status = BatchStatus.PACKED;
  }

  const newFinishedGood: FinishedGood = {
    id: `FG-${Date.now()}`,
    batchId: batch.id,
    recipeName: recipeName,
    packagingType: packagingType,
    quantity: packCount,
    datePacked: new Date().toISOString(),
    sellingPrice: 15.00 
  };
  mockFinishedGoods.unshift(newFinishedGood);

  // INVENTORY DEDUCTION
  const containerId = packagingType === 'POUCH' ? 'inv-pouch' : 'inv-tin';
  const stickerId = 'inv-sticker';
  
  await updateInventory(containerId, -packCount);
  await updateInventory(stickerId, -packCount);

  // AUTO LOG: PACKAGING COST (Batch Specific)
  const containerItem = mockInventory.find(i => i.id === containerId);
  const labelItem = mockInventory.find(i => i.id === stickerId);
  
  let containerUnitCost = 0;
  if (containerItem) {
      containerUnitCost = containerItem.unitCost / (containerItem.packSize || 1);
  }
  
  let labelUnitCost = 0;
  if (labelItem) {
      labelUnitCost = labelItem.unitCost / (labelItem.packSize || 1);
  }

  const totalPkgCost = (packCount * containerUnitCost) + (packCount * labelUnitCost);
  
  recordCostTransaction(
      batch.id, 
      0, 
      0, 
      totalPkgCost, 
      0, 
      0, 
      0
  );

  return { success: true, data: newFinishedGood };
};

export const packRecipeFIFO = async (
  recipeName: string,
  totalWeightToPack: number,
  totalPackCount: number,
  packagingType: 'TIN' | 'POUCH'
): Promise<ApiResponse<boolean>> => {
  const availableBatches = mockBatches
    .filter(b => 
      b.selectedRecipeName === recipeName && 
      (b.status === BatchStatus.DRYING_COMPLETE || (b.status === BatchStatus.PACKED && (b.remainingWeightKg || 0) > 0.1))
    )
    .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());
  
  const totalAvailable = availableBatches.reduce((sum, b) => sum + (b.remainingWeightKg ?? b.netWeightKg), 0);
  
  if (totalWeightToPack > totalAvailable + 0.1) {
      return { success: false, message: `Insufficient weight. Available: ${totalAvailable.toFixed(2)}kg` };
  }

  let weightNeeded = totalWeightToPack;
  let packsRemaining = totalPackCount;
  const yieldPerKg = totalPackCount / totalWeightToPack;

  for (const batch of availableBatches) {
      if (weightNeeded <= 0.01) break;
      
      const batchAvailable = batch.remainingWeightKg ?? batch.netWeightKg;
      const takeWeight = Math.min(batchAvailable, weightNeeded);
      let takePacks = Math.round(takeWeight * yieldPerKg);
      if (takeWeight >= weightNeeded - 0.01) {
          takePacks = packsRemaining;
      }
      
      if (takePacks > 0) {
          await packBatchPartial(batch.id, takeWeight, takePacks, packagingType, recipeName);
          packsRemaining -= takePacks;
      }
      weightNeeded -= takeWeight;
  }
  
  return { success: true, message: "Packed successfully." };
};

export const getFinishedGoods = async (forceRemote = false): Promise<ApiResponse<FinishedGood[]>> => {
  if (forceRemote) await pullFullDatabase();
  return { success: true, data: [...mockFinishedGoods] };
};

export const getPackingHistory = async (): Promise<ApiResponse<FinishedGood[]>> => {
  return { success: true, data: mockFinishedGoods.slice(0, 10) };
};

export const updateFinishedGoodImage = async (recipeName: string, packagingType: string, imageUrl: string): Promise<ApiResponse<boolean>> => {
  mockFinishedGoods.forEach(fg => {
    if (fg.recipeName === recipeName && fg.packagingType === packagingType) fg.imageUrl = imageUrl;
  });
  return { success: true, message: "Image updated" };
};

export const updateFinishedGoodPrice = async (recipeName: string, packagingType: string, price: number): Promise<ApiResponse<boolean>> => {
  mockFinishedGoods.forEach(fg => {
    if (fg.recipeName === recipeName && fg.packagingType === packagingType) fg.sellingPrice = price;
  });
  return { success: true, message: "Price updated" };
};

// ============================================================================
// INVENTORY & PROCUREMENT
// ============================================================================
export const getInventory = async (forceRemote = false): Promise<ApiResponse<InventoryItem[]>> => {
  if (forceRemote) await pullFullDatabase();
  return { success: true, data: [...mockInventory] };
};

export const updateInventory = async (id: string, change: number, newCost?: number): Promise<ApiResponse<InventoryItem>> => {
  const index = mockInventory.findIndex(i => i.id === id);
  if (index !== -1) {
    mockInventory[index].quantity += change;
    if (newCost !== undefined) mockInventory[index].unitCost = newCost;
    return { success: true, data: mockInventory[index] };
  }
  return { success: false, message: "Item not found" };
};

export const addInventoryItem = async (item: InventoryItem): Promise<ApiResponse<InventoryItem>> => {
  const exists = mockInventory.find(i => i.name === item.name);
  if (exists) {
      exists.supplier = item.supplier;
      return { success: true, data: exists };
  }
  mockInventory.push(item);
  return { success: true, data: item };
};

export const getSuppliers = async (): Promise<ApiResponse<Supplier[]>> => {
  return { success: true, data: [...mockSuppliers] };
};

export const addSupplier = async (supplier: Supplier): Promise<ApiResponse<Supplier>> => {
  mockSuppliers.push(supplier);
  return { success: true, data: supplier };
};

export const deleteSupplier = async (id: string): Promise<ApiResponse<boolean>> => {
  const initLen = mockSuppliers.length;
  mockSuppliers = mockSuppliers.filter(s => s.id !== id);
  return { success: mockSuppliers.length < initLen, message: "Supplier removed" };
};

export const getPurchaseOrders = async (): Promise<ApiResponse<PurchaseOrder[]>> => {
  return { success: true, data: [...mockPurchaseOrders] };
};

export const createPurchaseOrder = async (itemId: string, qtyPackages: number, supplier: string): Promise<ApiResponse<PurchaseOrder>> => {
  const item = mockInventory.find(i => i.id === itemId);
  if (!item) return { success: false, message: "Item not found" };

  const totalUnits = qtyPackages * (item.packSize || 1);
  const totalCost = qtyPackages * item.unitCost;

  const newPO: PurchaseOrder = {
    id: `PO-${Date.now()}`,
    itemId,
    itemName: item.name,
    quantity: qtyPackages,
    packSize: item.packSize || 1,
    totalUnits: totalUnits,
    unitCost: item.unitCost,
    totalCost: totalCost,
    status: 'ORDERED',
    dateOrdered: new Date().toISOString(),
    supplier
  };
  mockPurchaseOrders.unshift(newPO);
  return { success: true, data: newPO };
};

export const receivePurchaseOrder = async (poId: string, qcPassed: boolean, notes?: string): Promise<ApiResponse<PurchaseOrder>> => {
  const index = mockPurchaseOrders.findIndex(p => p.id === poId);
  if (index === -1) return { success: false, message: "PO not found" };
  const po = mockPurchaseOrders[index];
  
  if (!qcPassed) {
    mockPurchaseOrders[index].status = 'COMPLAINT';
    mockPurchaseOrders[index].qcPassed = false;
    mockPurchaseOrders[index].complaintReason = notes || "QC Failed on Receipt";
    return { success: true, data: mockPurchaseOrders[index] };
  }

  mockPurchaseOrders[index].status = 'RECEIVED';
  mockPurchaseOrders[index].dateReceived = new Date().toISOString();
  mockPurchaseOrders[index].qcPassed = true;
  await updateInventory(po.itemId, po.totalUnits);
  return { success: true, data: mockPurchaseOrders[index] };
};

export const complaintPurchaseOrder = async (poId: string, reason: string): Promise<ApiResponse<PurchaseOrder>> => {
  const index = mockPurchaseOrders.findIndex(p => p.id === poId);
  mockPurchaseOrders[index].status = 'COMPLAINT';
  mockPurchaseOrders[index].complaintReason = reason;
  return { success: true, data: mockPurchaseOrders[index] };
};

export const resolveComplaint = async (poId: string, resolution: string): Promise<ApiResponse<PurchaseOrder>> => {
  const index = mockPurchaseOrders.findIndex(p => p.id === poId);
  if (index === -1) return { success: false, message: "PO not found" };
  
  mockPurchaseOrders[index].status = 'RESOLVED';
  mockPurchaseOrders[index].complaintResolution = resolution;
  if (resolution.toLowerCase().includes('replacement') || resolution.toLowerCase().includes('received')) {
      const po = mockPurchaseOrders[index];
      await updateInventory(po.itemId, po.totalUnits);
  }
  return { success: true, data: mockPurchaseOrders[index] };
};

// ============================================================================
// SALES & CUSTOMERS
// ============================================================================
export const getCustomers = async (): Promise<ApiResponse<Customer[]>> => {
  return { success: true, data: [...mockCustomers] };
};

export const addCustomer = async (customer: Customer): Promise<ApiResponse<Customer>> => {
  mockCustomers.push(customer);
  return { success: true, data: customer };
};

export const getSales = async (): Promise<ApiResponse<SalesRecord[]>> => {
  return { success: true, data: [...mockSales] };
};

export const createSale = async (
  customerId: string, 
  finishedGoodId: string, 
  qty: number, 
  unitPrice: number, 
  paymentMethod: PaymentMethod
): Promise<ApiResponse<SalesRecord>> => {
  
  const sampleGood = mockFinishedGoods.find(f => f.id === finishedGoodId);
  if (!sampleGood) return { success: false, message: "Product not found" };

  const matchingGoods = mockFinishedGoods
      .filter(f => f.recipeName === sampleGood.recipeName && f.packagingType === sampleGood.packagingType && f.quantity > 0)
      .sort((a,b) => new Date(a.datePacked).getTime() - new Date(b.datePacked).getTime());

  let toDeduct = qty;
  for (const item of matchingGoods) {
      if (toDeduct <= 0) break;
      const take = Math.min(item.quantity, toDeduct);
      item.quantity -= take;
      toDeduct -= take;
  }

  if (toDeduct > 0) return { success: false, message: "Insufficient stock" };

  const customer = mockCustomers.find(c => c.id === customerId);
  const newSale: SalesRecord = {
    id: `SALE-${Date.now()}`,
    invoiceId: `INV-${Math.floor(Math.random() * 100000)}`,
    customerId,
    customerName: customer ? customer.name : 'Unknown',
    customerEmail: customer?.email,
    customerPhone: customer?.contact,
    items: [{
      finishedGoodId: finishedGoodId,
      recipeName: sampleGood.recipeName,
      packagingType: sampleGood.packagingType,
      quantity: qty,
      unitPrice
    }],
    totalAmount: qty * unitPrice,
    paymentMethod,
    status: 'INVOICED',
    dateCreated: new Date().toISOString()
  };
  mockSales.unshift(newSale);
  return { success: true, data: newSale };
};

export const updateSaleStatus = async (saleId: string, status: SalesStatus): Promise<ApiResponse<SalesRecord>> => {
  const index = mockSales.findIndex(s => s.id === saleId);
  if (index === -1) return { success: false, message: "Sale not found" };

  mockSales[index].status = status;
  if (status === 'DELIVERED') mockSales[index].dateDelivered = new Date().toISOString();
  return { success: true, data: mockSales[index] };
};

// ============================================================================
// ANALYSIS & COSTS
// ============================================================================
export const getDailyProductionCosts = async (forceRemote = false): Promise<ApiResponse<DailyCostMetrics[]>> => {
  if (forceRemote) await pullFullDatabase();

  const laborRate = getLaborRate();
  const rawRate = getRawMaterialRate();
  
  // Initialize mock data if empty (First Load Simulation - Transactional)
  if (mockDailyCosts.length === 0) {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const batchId = `BATCH-SIM-${i}`;
        const weight = 100 + (i * 10);
        
        // 1. Raw Material Transaction
        mockDailyCosts.push({
            id: `COST-RAW-${i}`,
            referenceId: batchId,
            date: dateStr,
            weightProcessed: weight,
            processingHours: 0,
            rawMaterialCost: parseFloat((weight * rawRate).toFixed(2)),
            packagingCost: 0,
            wastageCost: 0,
            laborCost: 0,
            totalCost: parseFloat((weight * rawRate).toFixed(2))
        });

        // 2. Labor Transaction
        const hours = parseFloat((weight / 20).toFixed(2));
        mockDailyCosts.push({
            id: `COST-LAB-${i}`,
            referenceId: batchId,
            date: dateStr,
            weightProcessed: 0,
            processingHours: hours,
            rawMaterialCost: 0,
            packagingCost: 0,
            wastageCost: 0,
            laborCost: parseFloat((hours * laborRate).toFixed(2)),
            totalCost: parseFloat((hours * laborRate).toFixed(2))
        });

        // 3. Packaging Transaction
        const packs = weight * 4; // approx
        mockDailyCosts.push({
            id: `COST-PKG-${i}`,
            referenceId: batchId,
            date: dateStr,
            weightProcessed: 0,
            processingHours: 0,
            rawMaterialCost: 0,
            packagingCost: parseFloat((packs * 0.55).toFixed(2)), // Approx cost
            wastageCost: 0,
            laborCost: 0,
            totalCost: parseFloat((packs * 0.55).toFixed(2))
        });
    }
    // Sort desc date
    mockDailyCosts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return { success: true, data: mockDailyCosts };
};

export const updateDailyCost = async (id: string, updates: Partial<DailyCostMetrics>): Promise<ApiResponse<boolean>> => {
    const index = mockDailyCosts.findIndex(c => c.id === id); // Use ID now
    if (index !== -1) {
        // Update values
        mockDailyCosts[index] = { ...mockDailyCosts[index], ...updates };
        // Recalculate Total
        const c = mockDailyCosts[index];
        c.totalCost = c.rawMaterialCost + c.packagingCost + c.wastageCost + c.laborCost;
        return { success: true, message: "Cost updated successfully" };
    }
    return { success: false, message: "Transaction record not found" };
};

export const getWeeklyRevenue = async (): Promise<{date: string, amount: number}[]> => {
    const revenueMap: Record<string, number> = {};
    const today = new Date();
    for(let i=6; i>=0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        revenueMap[d.toISOString().split('T')[0]] = 0;
    }
    mockSales.forEach(s => {
        const date = s.dateCreated.split('T')[0];
        if (revenueMap[date] !== undefined && s.status === 'DELIVERED') {
            revenueMap[date] += s.totalAmount;
        }
    });
    return Object.keys(revenueMap).map(date => ({ date, amount: revenueMap[date] }));
};