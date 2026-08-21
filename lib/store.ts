import { create } from "zustand"
import type { Product, Stage, ApprovalJustification, SimilarJustification } from "./types"

interface ProductStore {
  products: Product[]
  currentStage: Stage
  selectedProducts: string[]
  justifications: ApprovalJustification[]
  similarJustifications: SimilarJustification[]
  isGeneratingJustification: boolean
  commonSeason: string
  commonTranch: string
  workflowMode: "full" | "direct" | null

  setStage: (stage: Stage) => void
  addProduct: (product: Product) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  removeProduct: (id: string) => void
  setProducts: (products: Product[]) => void
  toggleProductSelection: (id: string) => void
  selectAllProducts: () => void
  setSelectedProducts: (ids: string[]) => void
  clearSelection: () => void
  addJustification: (justification: ApprovalJustification) => void
  setSimilarJustifications: (justifications: SimilarJustification[]) => void
  setIsGeneratingJustification: (isGenerating: boolean) => void
  setCommonSeason: (season: string) => void
  setCommonTranch: (tranch: string) => void
  applyCommonSeasonAndTranch: () => void
  setWorkflowMode: (mode: "full" | "direct" | null) => void
  resetStore: () => void
}

const initialState = {
  products: [],
  currentStage: 1 as Stage,
  selectedProducts: [],
  justifications: [],
  similarJustifications: [],
  isGeneratingJustification: false,
  commonSeason: "",
  commonTranch: "",
  workflowMode: null as "full" | "direct" | null,
}

export const useProductStore = create<ProductStore>((set, get) => ({
  ...initialState,

  setStage: (stage) => set({ currentStage: stage }),

  addProduct: (product) =>
    set((state) => ({
      products: [...state.products, product],
    })),

  updateProduct: (id, updates) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removeProduct: (id) =>
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
      selectedProducts: state.selectedProducts.filter((pid) => pid !== id),
    })),

  setProducts: (products) => set({ products }),

  toggleProductSelection: (id) =>
    set((state) => ({
      selectedProducts: state.selectedProducts.includes(id)
        ? state.selectedProducts.filter((pid) => pid !== id)
        : [...state.selectedProducts, id],
    })),

  selectAllProducts: () =>
    set((state) => ({
      selectedProducts: state.products.filter((p) => p.status === "pending_review").map((p) => p.id),
    })),

  setSelectedProducts: (ids) => set({ selectedProducts: ids }),

  clearSelection: () => set({ selectedProducts: [] }),

  addJustification: (justification) =>
    set((state) => ({
      justifications: [...state.justifications, justification],
    })),

  setSimilarJustifications: (justifications) =>
    set({
      similarJustifications: justifications,
    }),

  setIsGeneratingJustification: (isGenerating) =>
    set({
      isGeneratingJustification: isGenerating,
    }),

  setCommonSeason: (season) => set({ commonSeason: season }),

  setCommonTranch: (tranch) => set({ commonTranch: tranch }),

  applyCommonSeasonAndTranch: () =>
    set((state) => ({
      products: state.products.map((p) => ({
        ...p,
        season: state.commonSeason,
        tranch: state.commonTranch,
        // Also update the EG data's Tranche field if egData exists
        egData: p.egData
          ? {
              ...p.egData,
              data: {
                ...p.egData.data,
                Tranche: state.commonTranch,
              },
            }
          : p.egData,
      })),
    })),

  setWorkflowMode: (mode) => set({ workflowMode: mode }),

  resetStore: () => set(initialState),
}))
