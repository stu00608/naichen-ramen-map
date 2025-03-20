"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Edit, Plus, Search, Star, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useFirestore, firestoreConstraints } from "@/hooks/useFirestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StarRating } from "@/components/ui/star-rating"

// Define interfaces for the review data
interface RamenItem {
  name: string;
  price?: number;
  currency: string;
  preference?: string;
}

interface SideMenuItem {
  name: string;
  price?: number;
  currency: string;
}

interface Review {
  id: string;
  shop_id: string;
  shop_name?: string;
  visit_date: { toDate: () => Date };
  people_count: string;
  reservation_type: string;
  wait_time?: string;
  ramen_items: RamenItem[];
  side_menu: SideMenuItem[];
  soup_score: number;
  noodle_score: number;
  topping_score: number;
  appearance_score: number;
  experience_score: number;
  value_score: number;
  overall_score: number;
  notes?: string;
  images?: string[];
  created_at: { toDate: () => Date };
  updated_at: { toDate: () => Date };
  search_content?: string;
  source?: string;
}

export default function ReviewsPage() {
  const router = useRouter()
  const { getDocuments, deleteDocument, loading, error } = useFirestore("reviews")
  const [reviews, setReviews] = useState<Review[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState("created_at_desc")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const ITEMS_PER_PAGE = 10

  // Load reviews
  useEffect(() => {
    fetchReviews()
  }, [currentPage, sortBy])

  // Function to fetch reviews
  const fetchReviews = async () => {
    setIsLoading(true)
    try {
      // Apply sorting
      const constraints: any[] = []
      
      if (sortBy === "created_at_desc") {
        constraints.push(firestoreConstraints.orderBy("created_at", "desc"))
      } else if (sortBy === "created_at_asc") {
        constraints.push(firestoreConstraints.orderBy("created_at", "asc"))
      } else if (sortBy === "visit_date_desc") {
        constraints.push(firestoreConstraints.orderBy("visit_date", "desc"))
      } else if (sortBy === "visit_date_asc") {
        constraints.push(firestoreConstraints.orderBy("visit_date", "asc"))
      } else if (sortBy === "overall_score_desc") {
        constraints.push(firestoreConstraints.orderBy("overall_score", "desc"))
      } else if (sortBy === "overall_score_asc") {
        constraints.push(firestoreConstraints.orderBy("overall_score", "asc"))
      }
      
      // Adding pagination limit
      constraints.push(firestoreConstraints.limit(ITEMS_PER_PAGE))
      
      // Fetch the reviews
      const result = await getDocuments(constraints)
      
      if (Array.isArray(result)) {
        setReviews(result as Review[])
        
        // For simplicity, we're simulating total pages here
        // In a real app, you'd need to get the total count from Firestore
        setTotalPages(Math.max(1, Math.ceil(result.length / ITEMS_PER_PAGE)))
      }
    } catch (err) {
      console.error("Error fetching reviews:", err)
      toast.error("無法載入評價列表")
    } finally {
      setIsLoading(false)
    }
  }

  // Function to handle search
  const handleSearch = async () => {
    setIsLoading(true)
    try {
      if (!searchQuery.trim()) {
        // If search query is empty, reset to default list
        fetchReviews()
        return
      }
      
      // TODO: Implement search logic
      // In a real implementation, you'd search Firestore
      // This would likely involve:
      // 1. Either using a search index
      // 2. Or searching by specific fields
      
      // For now we'll simulate this with a simple filter
      const result = await getDocuments([])
      
      if (Array.isArray(result)) {
        const filteredReviews = result.filter((review: any) => 
          review.search_content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          review.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          review.notes?.toLowerCase().includes(searchQuery.toLowerCase())
        ) as Review[]
        
        setReviews(filteredReviews)
        setTotalPages(Math.max(1, Math.ceil(filteredReviews.length / ITEMS_PER_PAGE)))
      }
    } catch (err) {
      console.error("Error searching reviews:", err)
      toast.error("搜尋評價時發生錯誤")
    } finally {
      setIsLoading(false)
    }
  }

  // Function to handle review deletion
  const handleDeleteReview = async () => {
    if (!reviewToDelete) return
    
    try {
      const success = await deleteDocument(reviewToDelete)
      
      if (success) {
        toast.success("評價已成功刪除")
        
        // Refresh the list
        fetchReviews()
      } else {
        toast.error("刪除評價失敗")
      }
    } catch (err) {
      console.error("Error deleting review:", err)
      toast.error("刪除評價時發生錯誤")
    } finally {
      setShowDeleteConfirm(false)
      setReviewToDelete(null)
    }
  }

  // Function to open the delete confirmation dialog
  const openDeleteConfirm = (reviewId: string) => {
    setReviewToDelete(reviewId)
    setShowDeleteConfirm(true)
  }

  // Function to format a date
  const formatDate = (date: Date) => {
    return format(date, "yyyy/MM/dd")
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">拉麵評價管理</h1>
        <Button onClick={() => router.push("/dashboard/reviews/new")}>
          <Plus className="h-4 w-4 mr-2" />
          新增評價
        </Button>
      </div>
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded">
          {error}
        </div>
      )}
      
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="搜尋評價..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleSearch}
              >
                <Search className="h-4 w-4 mr-2" />
                搜尋
              </Button>
            </div>
            
            <div className="flex-none w-full md:w-[200px]">
              <Select
                value={sortBy}
                onValueChange={setSortBy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">評價時間 (新到舊)</SelectItem>
                  <SelectItem value="created_at_asc">評價時間 (舊到新)</SelectItem>
                  <SelectItem value="visit_date_desc">造訪日期 (新到舊)</SelectItem>
                  <SelectItem value="visit_date_asc">造訪日期 (舊到新)</SelectItem>
                  <SelectItem value="overall_score_desc">評分 (高到低)</SelectItem>
                  <SelectItem value="overall_score_asc">評分 (低到高)</SelectItem>
                                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Reviews Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">載入中...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">沒有找到評價記錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>店家</TableHead>
                    <TableHead>評分</TableHead>
                    <TableHead>造訪日期</TableHead>
                    <TableHead>品項摘要</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell className="font-medium">
                        {review.shop_name || "未知店家"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <StarRating value={review.overall_score} readonly size="sm" />
                          <span className="ml-2">{review.overall_score.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {review.visit_date ? formatDate(review.visit_date.toDate()) : "未知日期"}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate">
                          {review.ramen_items?.map(item => item.name).join(", ") || "無品項資料"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/dashboard/reviews/${review.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive/90"
                            onClick={() => openDeleteConfirm(review.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        onClick={() => setCurrentPage(i + 1)}
                        isActive={currentPage === i + 1}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              您確定要刪除這筆拉麵評價嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteReview}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
