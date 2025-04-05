#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures::TryStreamExt;
use mongodb::{
    bson::{self, doc, Document, oid::ObjectId},
    Client, 
    options::ClientOptions
};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Deserialize, Serialize, Clone)]
struct Item {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    name: String,
    description: String,
    price: f64,
}

#[tauri::command]
async fn db_find_items(
    client: State<'_, Client>,
    collection: String,
) -> Result<Vec<Item>, String> {
    println!("Finding all items");
    
    // Get database
    let db = match client.default_database() {
        Some(db) => db,
        None => client.database("heheheheh"),
    };
    
    let target_collection = db.collection::<Document>(&collection);
    let filter = doc! {};
    
    let cursor = target_collection
        .find(filter)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    let mut cursor = cursor;
    
    while let Some(result) = cursor.try_next().await.map_err(|e| e.to_string())? {
        // Explicitly extract and convert the ObjectId to string
        let id = match result.get_object_id("_id") {
            Ok(oid) => {
                let id_str = oid.to_hex();
                println!("Found item with ID: {}", id_str);
                id_str
            },
            Err(e) => {
                println!("Error getting _id: {}", e);
                continue; // Skip this document if we can't get the ID
            }
        };
        
        // Create a new document with string ID
        let mut doc = result.clone();
        doc.remove("_id"); // Remove the ObjectId
        doc.insert("_id", id); // Add the string ID
        
        match bson::from_document::<Item>(doc) {
            Ok(item) => {
                println!("Found item: {:?}", item);
                results.push(item);
            },
            Err(e) => {
                println!("Error deserializing: {}", e);
                continue;
            }
        };
    }
    
    println!("Found {} items", results.len());
    Ok(results)
}

#[tauri::command]
async fn db_add_item(
    client: State<'_, Client>,
    collection: String,
    item: Item,
) -> Result<String, String> {
    println!("Adding new item: {:?}", item);
    
    let db = match client.default_database() {
        Some(db) => db,
        None => client.database("heheheheh"),
    };
    
    let target_collection = db.collection::<Document>(&collection);
    
    // Create a new document without the id field
    let mut doc = bson::to_document(&item)
        .map_err(|e| format!("Failed to serialize item: {}", e))?;
    
    // Remove any existing _id field as MongoDB will generate one
    doc.remove("_id");
    
    let result: mongodb::results::InsertOneResult = target_collection.insert_one(doc)
        .await
        .map_err(|e| format!("Failed to insert document: {}", e))?;
    
    // Return the new ID
    match result.inserted_id.as_object_id() {
        Some(id) => {
            let id_str = id.to_hex();
            println!("Item added with ID: {}", id_str);
            Ok(id_str)
        },
        None => Err("Failed to get inserted ID".to_string())
    }
}

#[tauri::command]
async fn db_update_item(
    client: State<'_, Client>,
    collection: String,
    id: String,
    item: Item,
) -> Result<bool, String> {
    println!("Updating item with ID: {}, data: {:?}", id, item);
    
    let db = match client.default_database() {
        Some(db) => db,
        None => client.database("heheheheh"),
    };
    
    let target_collection = db.collection::<Document>(&collection);
    
    // Convert string ID to ObjectId
    let object_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(e) => {
            println!("Invalid ObjectId: {} - {}", id, e);
            return Err(format!("Invalid ObjectId: {}", e));
        }
    };
    
    // Create update document
    let mut doc = match bson::to_document(&item) {
        Ok(d) => d,
        Err(e) => return Err(format!("Failed to serialize item: {}", e)),
    };
    
    // Remove _id from update document
    doc.remove("_id");
    
    let filter = doc! { "_id": object_id };
    let update = doc! { "$set": doc };
    
    println!("Update filter: {:?}", filter);
    println!("Update document: {:?}", update);
    
    let result = target_collection.update_one(filter, update)
        .await
        .map_err(|e| format!("Failed to update document: {}", e))?;
    
    println!("Update result: matched={}, modified={}", 
              result.matched_count, result.modified_count);
    
    Ok(result.modified_count > 0)
}

#[tauri::command]
async fn db_delete_item(
    client: State<'_, Client>,
    collection: String,
    id: String,
) -> Result<bool, String> {
    println!("Deleting item with ID: {}", id);
    
    let db = match client.default_database() {
        Some(db) => db,
        None => client.database("heheheheh"),
    };
    
    let target_collection = db.collection::<Document>(&collection);
    
    // Convert string ID to ObjectId
    let object_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(e) => {
            println!("Invalid ObjectId: {} - {}", id, e);
            return Err(format!("Invalid ObjectId: {}", e));
        }
    };
    
    let filter = doc! { "_id": object_id };
    
    println!("Delete filter: {:?}", filter);
    
    let result = target_collection.delete_one(filter)
        .await
        .map_err(|e| format!("Failed to delete document: {}", e))?;
    
    println!("Delete result: deleted_count={}", result.deleted_count);
    
    Ok(result.deleted_count > 0)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_url = "mongodb+srv://peyu5h:password@cy.kdshn.mongodb.net/heheheheh?retryWrites=true&w=majority";
    
    let options = ClientOptions::parse(db_url).await?;
    let client = Client::with_options(options)?;
    
    client.database("admin")
        .run_command(doc! {"ping": 1})
        .await?;
    
    println!("Connected to MongoDB!");

    tauri::Builder::default()
        .manage(client)
        .invoke_handler(tauri::generate_handler![
            db_find_items,
            db_add_item,
            db_update_item,
            db_delete_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
        
    Ok(())
}