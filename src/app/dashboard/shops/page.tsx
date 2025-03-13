"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { collection, query, orderBy, getDocs, limit, startAfter } from "firebase/firestore"
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

  useEffect(() => {
    const fetchShops = async () => {
      try {
        setLoading(true)
        // Get total count
        const totalQuery = query(collection(db, "shops"))
        const totalSnapshot = await getDocs(totalQuery)
        setTotalShops(totalSnapshot.size)

        // Get first page
        const q = query(
          collection(db, "shops"),
          orderBy("created_at", "desc"),
          limit(itemsPerPage)
        )
        const querySnapshot = await getDocs(q)
        
        const shopsData: Shop[] = []
        querySnapshot.forEach((doc) => {
          shopsData.push({ id: doc.id, ...doc.data() } as Shop)
        })
        
        setShops(shopsData)
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
        setFirstVisible(querySnapshot.docs[0])
        setPageSnapshots([querySnapshot.docs[0]])
      } catch (error) {
        console.error("Error fetching shops:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchShops()
  }, [itemsPerPage])

  const handleNextPage = async () => {
    if (!lastVisible) return

    try {
      setLoading(true)
      const q = query(
        collection(db, "shops"),
        orderBy("created_at", "desc"),
        startAfter(lastVisible),
        limit(itemsPerPage)
      )
      const querySnapshot = await getDocs(q)

      const shopsData: Shop[] = []
      querySnapshot.forEach((doc) => {
        shopsData.push({ id: doc.id, ...doc.data() } as Shop)
      })

      setShops(shopsData)
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
      setFirstVisible(querySnapshot.docs[0])
      setCurrentPage(prev => prev + 1)
      setPageSnapshots(prev => [...prev, querySnapshot.docs[0]])
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
      const q = query(
        collection(db, "shops"),
        orderBy("created_at", "desc"),
        startAfter(pageSnapshots[currentPage - 2]),
        limit(itemsPerPage)
      )
      const querySnapshot = await getDocs(q)

      const shopsData: Shop[] = []
      querySnapshot.forEach((doc) => {
        shopsData.push({ id: doc.id, ...doc.data() } as Shop)
      })

      setShops(shopsData)
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
      setFirstVisible(querySnapshot.docs[0])
      setCurrentPage(prev => prev - 1)
    } catch (error) {
      console.error("Error fetching previous page:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!shopToDelete) return

    const success = await deleteDocument(shopToDelete)
    if (success) {
      setShops(shops.filter(shop => shop.id !== shopToDelete))
      setTotalShops(prev => prev - 1)
    }
    setShopToDelete(null)
  }

  const handlePageClick = async (page: number) => {
    if (page === currentPage) return
    
    try {
      setLoading(true)
      let q;
      
      if (page > currentPage) {
        // Going forward
        q = query(
          collection(db, "shops"),
          orderBy("created_at", "desc"),
          startAfter(lastVisible),
          limit(itemsPerPage)
        )
      } else {
        // Going backward
        q = query(
          collection(db, "shops"),
          orderBy("created_at", "desc"),
          startAfter(pageSnapshots[page - 1]),
          limit(itemsPerPage)
        )
      }
      
      const querySnapshot = await getDocs(q)
      const shopsData: Shop[] = []
      querySnapshot.forEach((doc) => {
        shopsData.push({ id: doc.id, ...doc.data() } as Shop)
      })

      setShops(shopsData)
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1])
      setFirstVisible(querySnapshot.docs[0])
      setCurrentPage(page)
      
      // Update page snapshots if going forward
      if (page > currentPage) {
        setPageSnapshots(prev => [...prev, querySnapshot.docs[0]])
      }
    } catch (error) {
      console.error("Error fetching page:", error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalShops / itemsPerPage)

  return (
    <div>
      <div className="flex justify-between items-center mb-6 mt-4 max-h-[30px]">
        <h1 className="text-2xl font-bold">店家管理</h1>
        <Button asChild>
          <Link href="/dashboard/shops/new">新增店家</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p>載入中...</p>
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-card rounded-lg p-6 text-center">
          <p className="text-muted-foreground">尚未有店家資料。點擊「新增店家」開始添加。</p>
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
                      <div className="font-medium flex items-center gap-2">
                        {shop.name}
                        {shop.googleMapsUri && (
                          <a
                            href={shop.googleMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            ↗︎
                          </a>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{shop.address}</div>
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