"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  limit, 
  startAfter, 
  where, 
  doc, 
  getDoc,
  increment,
  runTransaction
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Shop } from "@/types"
import { useFirestore } from "@/hooks/useFirestore"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const { deleteDocument } = useFirestore("shops")
  const [shopToDelete, setShopToDelete] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalShops, setTotalShops] = useState<number>(0)
  const [lastVisible, setLastVisible] = useState<any>(null)
  const [firstVisible, setFirstVisible] = useState<any>(null)
  const [pageSnapshots, setPageSnapshots] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Add keyboard shortcut for search
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [])

  const handlePageClick = async (page: number) => {
    if (page === currentPage) return
    
    try {
      setLoading(true)
      const baseQuery = collection(db, "shops")
      
      if (page < currentPage) {
        // Going backwards - use the stored snapshot
        const snapshot = pageSnapshots[page - 2] // Use the last doc of the previous page
        let q
        if (debouncedSearchTerm) {
          const searchLower = debouncedSearchTerm.toLowerCase()
          q = query(
            baseQuery,
            where("searchTokens", "array-contains", searchLower),
            orderBy("created_at", "desc"),
            snapshot ? startAfter(snapshot) : limit(itemsPerPage),
            limit(itemsPerPage)
          )
        } else {
          q = query(
            baseQuery,
            orderBy("created_at", "desc"),
            snapshot ? startAfter(snapshot) : limit(itemsPerPage),
            limit(itemsPerPage)
          )
        }

        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          const shopsData: Shop[] = []
          querySnapshot.forEach((doc) => {
            shopsData.push({ id: doc.id, ...doc.data() } as Shop)
          })

          setShops(shopsData)
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
          setFirstVisible(querySnapshot.docs[0])
          setCurrentPage(page)
        }
      } else {
        // Going forwards - get new data
        const lastSnapshotToUse = pageSnapshots[page - 2] // Use the last doc of the previous page
        let q
        if (debouncedSearchTerm) {
          const searchLower = debouncedSearchTerm.toLowerCase()
          q = query(
            baseQuery,
            where("searchTokens", "array-contains", searchLower),
            orderBy("created_at", "desc"),
            lastSnapshotToUse ? startAfter(lastSnapshotToUse) : limit(itemsPerPage),
            limit(itemsPerPage)
          )
        } else {
          q = query(
            baseQuery,
            orderBy("created_at", "desc"),
            lastSnapshotToUse ? startAfter(lastSnapshotToUse) : limit(itemsPerPage),
            limit(itemsPerPage)
          )
        }

        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          const shopsData: Shop[] = []
          querySnapshot.forEach((doc) => {
            shopsData.push({ id: doc.id, ...doc.data() } as Shop)
          })

          setShops(shopsData)
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
          setFirstVisible(querySnapshot.docs[0])
          setCurrentPage(page)
          // Store the last document of the current page
          setPageSnapshots(prev => {
            const newSnapshots = [...prev]
            newSnapshots[page - 1] = querySnapshot.docs[querySnapshot.docs.length - 1]
            return newSnapshots
          })
        }
      }
    } catch (error) {
      console.error("Error fetching page:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchShops = async (searchTerm = "") => {
    try {
      setLoading(true)
      const baseQuery = collection(db, "shops")
      
      // Create query based on search term
      let q
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        q = query(
          baseQuery,
          where("searchTokens", "array-contains", searchLower),
          orderBy("created_at", "desc"),
          limit(itemsPerPage)
        )
      } else {
        q = query(
          baseQuery,
          orderBy("created_at", "desc"),
          limit(itemsPerPage)
        )
      }

      // Get total count
      let total
      if (searchTerm) {
        const countQuery = query(
          baseQuery,
          where("searchTokens", "array-contains", searchTerm.toLowerCase())
        )
        const snapshot = await getDocs(countQuery)
        total = snapshot.size
      } else {
        const statsDoc = doc(db, 'stats', 'shops')
        const statsSnapshot = await getDoc(statsDoc)
        total = statsSnapshot.exists() ? statsSnapshot.data()?.totalShops || 0 : 0
      }
      setTotalShops(total)

      // Get paginated results
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const shopsData: Shop[] = []
        querySnapshot.forEach((doc) => {
          shopsData.push({ id: doc.id, ...doc.data() } as Shop)
        })
        
        setShops(shopsData)
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
        setFirstVisible(querySnapshot.docs[0])
        // Store the last document of the first page
        setPageSnapshots([querySnapshot.docs[querySnapshot.docs.length - 1]])
        setCurrentPage(1)
      } else {
        setShops([])
        setLastVisible(null)
        setFirstVisible(null)
        setPageSnapshots([])
        setCurrentPage(1)
      }
    } catch (error) {
      console.error("Error fetching shops:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleNextPage = async () => {
    if (!lastVisible || currentPage >= Math.ceil(totalShops / itemsPerPage)) return

    try {
      setLoading(true)
      const baseQuery = collection(db, "shops")
      
      let q
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase()
        q = query(
          baseQuery,
          where("searchTokens", "array-contains", searchLower),
          orderBy("created_at", "desc"),
          startAfter(lastVisible),
          limit(itemsPerPage)
        )
      } else {
        q = query(
          baseQuery,
          orderBy("created_at", "desc"),
          startAfter(lastVisible),
          limit(itemsPerPage)
        )
      }

      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const shopsData: Shop[] = []
        querySnapshot.forEach((doc) => {
          shopsData.push({ id: doc.id, ...doc.data() } as Shop)
        })

        setShops(shopsData)
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
        setFirstVisible(querySnapshot.docs[0])
        setCurrentPage(prev => prev + 1)
        // Store the last document of the current page
        setPageSnapshots(prev => [...prev, querySnapshot.docs[querySnapshot.docs.length - 1]])
      }
    } catch (error) {
      console.error("Error fetching next page:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousPage = async () => {
    if (currentPage <= 1) return

    try {
      setLoading(true)
      const baseQuery = collection(db, "shops")
      
      const prevPageSnapshot = pageSnapshots[currentPage - 3] // Use the last doc of the page before the previous page
      let q
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase()
        q = query(
          baseQuery,
          where("searchTokens", "array-contains", searchLower),
          orderBy("created_at", "desc"),
          prevPageSnapshot ? startAfter(prevPageSnapshot) : limit(itemsPerPage),
          limit(itemsPerPage)
        )
      } else {
        q = query(
          baseQuery,
          orderBy("created_at", "desc"),
          prevPageSnapshot ? startAfter(prevPageSnapshot) : limit(itemsPerPage),
          limit(itemsPerPage)
        )
      }

      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const shopsData: Shop[] = []
        querySnapshot.forEach((doc) => {
          shopsData.push({ id: doc.id, ...doc.data() } as Shop)
        })

        setShops(shopsData)
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
        setFirstVisible(querySnapshot.docs[0])
        setCurrentPage(prev => prev - 1)
      }
    } catch (error) {
      console.error("Error fetching previous page:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch shops when search term or page changes
  useEffect(() => {
    fetchShops(debouncedSearchTerm)
  }, [debouncedSearchTerm, itemsPerPage])

  const clearSearch = () => {
    setSearchTerm("")
    setCurrentPage(1)
  }

  const handleDelete = async () => {
    if (!shopToDelete) return

    try {
      await runTransaction(db, async (transaction) => {
        // Delete the shop
        const success = await deleteDocument(shopToDelete)
        if (success) {
          // Update the counter
          const statsDoc = doc(db, 'stats', 'shops')
          transaction.update(statsDoc, {
            totalShops: increment(-1)
          })
          
          setShops(shops.filter(shop => shop.id !== shopToDelete))
          setTotalShops(prev => prev - 1)
        }
      })
    } catch (error) {
      console.error("Error deleting shop:", error)
    }
    setShopToDelete(null)
  }

  const totalPages = Math.ceil(totalShops / itemsPerPage)

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 mt-4">
        <h1 className="text-2xl font-bold whitespace-nowrap">店家管理</h1>
        <div className="relative flex-1 max-w-xl mx-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder='搜尋店家名稱... (按 "/" 快速搜尋)'
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-8 pr-8"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button asChild className="whitespace-nowrap">
          <Link href="/dashboard/shops/new">新增店家</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p>載入中...</p>
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-card rounded-lg p-6 text-center">
          <p className="text-muted-foreground">
            {searchTerm ? "沒有符合搜尋條件的店家。" : "尚未有店家資料。點擊「新增店家」開始添加。"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card shadow-sm rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>店名</TableHead>
                  <TableHead>區域</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>標籤</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell>
                      <HoverCard>
                        <HoverCardTrigger className="cursor-default">
                          {shop.name}
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">{shop.address}</p>
                            {shop.googleMapsUri && (
                              <a
                                href={shop.googleMapsUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                              >
                                在 Google Maps 開啟
                                <span className="text-xs">↗︎</span>
                              </a>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </TableCell>
                    <TableCell>{shop.region}</TableCell>
                    <TableCell>
                      {shop.shop_types?.map((type) => (
                        <Badge key={type} variant="secondary" className="mr-1">
                          {type}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {shop.tags?.map((tag, index) => (
                          <Badge key={index} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" asChild className="mr-2">
                        <Link href={`/dashboard/shops/${shop.id}`}>編輯</Link>
                      </Button>
                      <Button variant="ghost" asChild className="mr-2">
                        <Link href={`/dashboard/reviews/new?shopId=${shop.id}`}>新增評價</Link>
                      </Button>
                      <AlertDialog open={shopToDelete === shop.id} onOpenChange={(open) => !open && setShopToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="text-destructive hover:text-destructive/90"
                            onClick={() => setShopToDelete(shop.id || null)}
                          >
                            刪除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>確定要刪除此店家嗎？</AlertDialogTitle>
                            <AlertDialogDescription>
                              此操作無法復原。所有與此店家相關的資料都將被永久刪除。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setShopToDelete(null)}>取消</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleDelete}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              確定刪除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              總共 {totalShops} 間店家
            </div>
            <div className="flex-1 flex justify-center items-center gap-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={handlePreviousPage}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive>{currentPage}</PaginationLink>
                  </PaginationItem>
                  {currentPage < totalPages && (
                    <>
                      {currentPage + 1 < totalPages && (
                        <>
                          <PaginationItem>
                            <PaginationLink onClick={() => handlePageClick(currentPage + 1)}>
                              {currentPage + 1}
                            </PaginationLink>
                          </PaginationItem>
                          <PaginationEllipsis />
                        </>
                      )}
                      <PaginationItem>
                        <PaginationLink onClick={() => handlePageClick(totalPages)}>
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={handleNextPage}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">每頁顯示：</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1)
                    setPageSnapshots([])
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue placeholder="10" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}