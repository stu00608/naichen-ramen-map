'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shop } from '@/types';
import { StarIcon, XIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface Review {
  id: string;
  title: string;
  content: string;
  rating: number;
  shopId: string;
  shopName: string;
  userId: string;
  userName: string;
  createdAt: any;
}

interface SearchResultsProps {
  isOpen: boolean;
  onClose: () => void;
  shopResults: Shop[];
  reviewResults: Review[];
  selectedShop: Shop | null;
  onSelectShop: (shop: Shop) => void;
  searchQuery: string; // Added to show current search query
}

export default function SearchResults({
  isOpen,
  onClose,
  shopResults,
  reviewResults,
  selectedShop,
  onSelectShop,
  searchQuery,
}: SearchResultsProps) {
  const [activeTab, setActiveTab] = useState<string>("shops");
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // If a shop is selected, show reviews for that shop
  const filteredReviews = selectedShop 
    ? reviewResults.filter(review => review.shopId === selectedShop.id)
    : reviewResults;
    
  // Prevent body scrolling when sidebar is open
  useEffect(() => {
    const preventScroll = (e: WheelEvent) => {
      if (sidebarRef.current?.contains(e.target as Node)) {
        e.stopPropagation();
      }
    };
    
    if (isOpen) {
      document.addEventListener('wheel', preventScroll, { passive: false });
    }
    
    return () => {
      document.removeEventListener('wheel', preventScroll);
    };
  }, [isOpen]);

  // Handle back button click - clear selected shop
  const handleBackToResults = () => {
    onSelectShop(null as any);
  };

  // Determine the sidebar height for mobile
  const mobileMaxHeight = isMobile ? 'h-2/3' : '';
  
  // Determine the proper sidebar positioning classes based on mobile or desktop view
  const sidebarPositionClasses = isMobile
    ? 'top-0 left-0 right-0 w-full max-h-2/3'
    : 'top-0 left-0 h-full w-[450px]';
    
  // Determine the transform class based on mobile or desktop
  const transformClass = isMobile
    ? isOpen ? 'translate-y-0' : '-translate-y-full'
    : isOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <div 
      ref={sidebarRef}
      className={`absolute bg-background border-border shadow-lg z-5 transition-transform duration-300 overflow-hidden ${sidebarPositionClasses} ${transformClass}`}
      style={{ 
        borderBottomLeftRadius: isMobile ? '1rem' : '0',
        borderBottomRightRadius: isMobile ? '1rem' : '0',
        borderRight: !isMobile ? '1px solid var(--border)' : 'none',
        borderBottom: isMobile ? '1px solid var(--border)' : 'none'
      }}
    >
      <div className="flex items-center justify-end p-4 border-b border-border">
        {/* Don't put components here, I mean to leave space for searchbox */}
        {/* <h2 className="text-lg font-semibold text-foreground">
          {selectedShop ? selectedShop.name : (searchQuery ? `"${searchQuery}" 的搜尋結果` : '搜尋結果')}
        </h2> */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="text-muted-foreground hover:text-foreground hover:bg-accent/50"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      
      <div className={`${isMobile ? 'max-h-[calc(66vh-65px)]' : 'h-[calc(100vh-65px)]'} overflow-hidden`}>
        {selectedShop ? (
          <div className="flex flex-col h-full">
            <div className="p-4">
              {/* Back button added here as a floating button at the start */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBackToResults}
                className="mb-3 text-xs flex items-center"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                返回搜尋結果
              </Button>
              
              <Card className="mb-4 bg-card border-border">
                <CardContent className="pt-4">
                  <h3 className="font-bold text-lg text-card-foreground">{selectedShop.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedShop.address}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedShop.shop_types?.map((type, index) => (
                      <span key={index} className="px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs">
                        {type}
                      </span>
                    ))}
                    <span className="px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs">
                      {selectedShop.region}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <h3 className="font-medium mb-2 text-foreground">評論 ({filteredReviews.length})</h3>
            </div>
            
            <ScrollArea className="flex-1 px-4 pb-4">
              {filteredReviews.length > 0 ? (
                filteredReviews.map(review => (
                  <Card key={review.id} className="mb-3 bg-card border-border">
                    <CardContent className="pt-4">
                      <div className="flex justify-between">
                        <h4 className="font-medium text-card-foreground">{review.title}</h4>
                        <div className="flex items-center">
                          {Array(5).fill(0).map((_, i) => (
                            <StarIcon 
                              key={i} 
                              className={`h-3 w-3 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {review.userName} · {new Date(review.createdAt?.toDate()).toLocaleDateString()}
                      </p>
                      <p className="text-sm mt-2 line-clamp-3 text-card-foreground">{review.content}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">尚無評論</p>
              )}
            </ScrollArea>
          </div>
        ) : (
          <Tabs defaultValue="shops" className="w-full" value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4 pt-2">
              <TabsList className="w-full">
                <TabsTrigger value="shops" className="flex-1">拉麵店 ({shopResults.length})</TabsTrigger>
                <TabsTrigger value="reviews" className="flex-1">評論 ({reviewResults.length})</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="shops" className="p-0 mt-0" style={{ height: isMobile ? 'calc(66vh - 110px)' : 'calc(100vh - 110px)' }}>
              <ScrollArea className="h-full">
                <div className="p-4">
                  {shopResults.length > 0 ? (
                    shopResults.map(shop => (
                      <Card 
                        key={shop.id} 
                        className="mb-3 hover:bg-accent/5 cursor-pointer bg-card border-border"
                        onClick={() => onSelectShop(shop)}
                      >
                        <CardContent className="p-3">
                          <h3 className="font-medium text-card-foreground">{shop.name}</h3>
                          <p className="text-sm text-muted-foreground">{shop.address}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {shop.shop_types.map((type, idx) => (
                              <span key={idx} className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                                {type}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">找不到符合的拉麵店</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="reviews" className="p-0 mt-0" style={{ height: isMobile ? 'calc(66vh - 110px)' : 'calc(100vh - 110px)' }}>
              <ScrollArea className="h-full">
                <div className="p-4">
                  {reviewResults.length > 0 ? (
                    reviewResults.map(review => (
                      <Card key={review.id} className="mb-3 bg-card border-border">
                        <CardContent className="p-3">
                          <h3 className="font-medium text-card-foreground">{review.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {review.shopName} · {review.userName} · {new Date(review.createdAt?.toDate()).toLocaleDateString()}
                          </p>
                          <div className="flex mt-1">
                            {Array(5).fill(0).map((_, i) => (
                              <StarIcon 
                                key={i} 
                                className={`h-3 w-3 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                              />
                            ))}
                          </div>
                          <p className="text-sm mt-2 line-clamp-3 text-card-foreground">{review.content}</p>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">找不到符合的評論</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}