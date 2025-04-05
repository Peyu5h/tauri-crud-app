"use client";

import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, X, Check, Search } from "lucide-react";
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Item {
  _id?: string;  // MongoDB's native field name
  id?: string;   // Your application's field name
  name: string;
  description: string;
  price: number;
}

export default function ItemList() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState<Item>({ name: '', description: '', price: 0 });
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    // Filter and sort items
    let result = [...items];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        return sortOrder === 'asc'
          ? a.price - b.price
          : b.price - a.price;
      }
    });

    setFilteredItems(result);
  }, [items, searchTerm, sortBy, sortOrder]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const fetchedItems = await invoke<any[]>('db_find_items', {
        collection: 'items'
      });

      console.log("Raw fetched items:", fetchedItems);

      const processedItems = fetchedItems.map(item => ({
        ...item,
        id: item._id,
      }));

      console.log("Processed items with IDs:", processedItems);
      setItems(processedItems);
    } catch (error) {
      console.error("Failed to load items:", error);
      toast.error("Failed to load items from database");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newItem.name || !newItem.description || newItem.price <= 0) {
      toast.error("Please fill all fields with valid values");
      return;
    }

    try {
      setSubmitting(true);
      const id = await invoke<string>('db_add_item', {
        collection: 'items',
        item: newItem
      });

      setNewItem({ name: '', description: '', price: 0 });
      toast.success("Item added successfully");

      // Add the new item to the list with the returned ID
      setItems(prev => [...prev, { ...newItem, id }]);
    } catch (error) {
      console.error("Failed to add item:", error);
      toast.error("Failed to add item to database");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    // Use _id as fallback if id is not available
    const itemId = editingItem.id || editingItem._id;

    if (!itemId) {
      console.error("Cannot update item without ID", editingItem);
      toast.error("Cannot update: Item has no ID");
      return;
    }

    console.log("Updating item with ID:", itemId);

    try {
      setSubmitting(true);
      const success = await invoke<boolean>('db_update_item', {
        collection: 'items',
        id: itemId,
        item: editingItem
      });

      if (success) {
        toast.success("Item updated successfully");
        setItems(prev => prev.map(item =>
          (item.id === itemId || item._id === itemId) ? editingItem : item
        ));
        setEditingItem(null);
      } else {
        toast.error("No changes were made");
      }
    } catch (error) {
      console.error("Failed to update item:", error);
      toast.error("Failed to update item in database");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    console.log("Handling delete for ID:", id);

    try {
      setSubmitting(true);
      const success = await invoke<boolean>('db_delete_item', {
        collection: 'items',
        id
      });

      if (success) {
        toast.success("Item deleted successfully");
        // Filter out the item with matching id or _id
        setItems(prev => prev.filter(item => item.id !== id && item._id !== id));
      } else {
        toast.error("Failed to delete item");
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item from database");
    } finally {
      setSubmitting(false);
      setDeleteConfirmId(null);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Manage your product catalog efficiently</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="md:self-end">
                <Plus className="mr-2 h-4 w-4" /> Add New Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
                <DialogDescription>
                  Fill out the details below to add a new item to your inventory.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddItem} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter item name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newItem.price === 0 ? "" : newItem.price.toString()}
                    onChange={(e) => setNewItem({
                      ...newItem,
                      price: e.target.value === "" ? 0 : parseFloat(e.target.value)
                    })}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter item description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    disabled={submitting}
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : "Add Item"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Sort by: {sortBy === 'name' ? 'Name' : 'Price'} ({sortOrder === 'asc' ? '↑' : '↓'})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('name')}>
                  Sort by Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('price')}>
                  Sort by Price
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleSortOrder}>
                  {sortOrder === 'asc' ? 'Descending Order' : 'Ascending Order'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>
        </div>

        {/* Items Display */}
        <div>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-lg border border-dashed">
              <h3 className="text-xl font-medium mb-2">No items found</h3>
              <p className="text-muted-foreground mb-4">
                {items.length === 0
                  ? "Your inventory is empty. Add your first item to get started."
                  : "No items match your search criteria."}
              </p>
              {items.length > 0 && (
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item, index) => (
                <Card key={`${item.id || index}-grid`} className="overflow-hidden flex flex-col h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-start">
                      <span className="truncate mr-2">{item.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingItem(item)}>
                            Edit Item
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmId(item.id || null)}
                          >
                            Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>
                  </CardContent>
                  <CardFooter className="bg-muted/30 border-t">
                    <Badge variant="outline" className="font-semibold text-primary bg-primary/10">
                      ${item.price.toFixed(2)}
                    </Badge>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {filteredItems.map((item, index) => (
                <div key={`${item.id || index}-list`} className="flex items-center p-4 gap-4">
                  <div className="flex-grow">
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                  </div>
                  <Badge variant="outline" className="font-semibold text-primary bg-primary/10">
                    ${item.price.toFixed(2)}
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log("Edit button clicked for item:", item);
                        // Ensure the item has an id before editing
                        const itemWithId = {
                          ...item,
                          id: item.id || item._id // Use existing id or _id
                        };
                        console.log("Setting item for editing:", itemWithId);
                        setEditingItem(itemWithId);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        console.log("Delete button clicked for item:", item);
                        // Use _id if id is not available
                        const itemId = item.id || item._id;
                        console.log("Using ID for deletion:", itemId);

                        if (itemId) {
                          setDeleteConfirmId(itemId);
                        } else {
                          console.error("Item has no ID:", item);
                          toast.error("Cannot delete: Item has no ID");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>
                Make changes to the item details below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Item Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter item name"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-price">Price ($)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editingItem.price === 0 ? "" : editingItem.price.toString()}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    price: e.target.value === "" ? 0 : parseFloat(e.target.value)
                  })}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Enter item description"
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  disabled={submitting}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateItem}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this item? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteItem(deleteConfirmId)}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : "Delete Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}