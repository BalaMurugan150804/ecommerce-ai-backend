"""
============================================================
  FastAPI Backend — E-Commerce AI Recommendation System
  E-Commerce AI Recommendation & Business Insights Project
============================================================
"""

# ── Imports ────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
import joblib
import random
import os

# ── Auth imports ───────────────────────────────────────────────────────────────
from database import engine, get_db
from models import Base
import auth

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="E-Commerce AI Recommendation & Business Insights API",
    description="""
## Final Year Project — AI-Powered E-Commerce System

This API connects three ML models:
- **K-Means Customer Segmentation** — classifies customers into Champions, Loyal, At-Risk, Lost
- **Apriori Basket Recommendations** — returns frequently bought together products
- **K-Means Product Clustering** — classifies products into Premium, Trending, Budget, Niche
    """,
    version="1.0.0",
)

# ── Create DB tables + register auth routes ────────────────────────────────────
Base.metadata.create_all(bind=engine)
app.include_router(auth.router)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Models & Data ─────────────────────────────────────────────────────────
print("\n🔄 Loading ML models …")

customer_model  = joblib.load("models/kmeans_customers.pkl")
customer_scaler = joblib.load("models/rfm_scaler.pkl")
product_model   = joblib.load("models/kmeans_products.pkl")
product_scaler  = joblib.load("models/product_scaler.pkl")
rules_df        = pd.read_csv("models/association_rules.csv")
customers_df    = pd.read_csv("outputs/customers_segmented.csv", dtype={"CustomerID": str})
products_df     = pd.read_csv("outputs/products_segmented.csv")

print("✅ All models loaded successfully!")
print(f"   Customers  : {len(customers_df):,}")
print(f"   Products   : {len(products_df):,}")
print(f"   Rules      : {len(rules_df):,}")

# ── Cluster Label Maps ─────────────────────────────────────────────────────────
CUSTOMER_LABELS = {
    0: "At-Risk",
    1: "Lost",
    2: "Champions",
    3: "Loyal",
}

PRODUCT_LABELS = {
    0: "Budget",
    1: "Trending",
    2: "Premium",
    3: "Niche",
}

CUSTOMER_ACTIONS = {
    "Champions": "Reward with loyalty points. Show premium & new arrival products.",
    "Loyal":     "Upsell higher-margin products. Ask for reviews. Offer early access.",
    "At-Risk":   "Send win-back email with personalised discount code.",
    "Lost":      "Last-chance offer or exit survey to understand churn reason.",
}

PRODUCT_ACTIONS = {
    "Premium":  "Highlight as exclusive. Target Champions segment customers only.",
    "Trending": "Feature on homepage. Push to all customer segments.",
    "Budget":   "Bundle with Premium items. Use in At-Risk win-back campaigns.",
    "Niche":    "Target to specific loyal buyers. Avoid mass promotion.",
}

# ── Request Schemas ────────────────────────────────────────────────────────────
class CustomerRFMRequest(BaseModel):
    recency:   int   = 30
    frequency: int   = 5
    monetary:  float = 500.0

class ProductRequest(BaseModel):
    avg_price:        float = 3.50
    total_quantity:   int   = 1000
    num_transactions: int   = 150
    num_customers:    int   = 120
    total_revenue:    float = 3500.0


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["System"])
def root():
    return {
        "status":  "✅ API is running",
        "project": "E-Commerce AI Recommendation & Business Insights",
        "models":  ["K-Means Customers", "K-Means Products", "Apriori Rules"],
        "docs":    "Visit /docs for interactive Swagger UI",
    }


@app.get("/health", tags=["System"])
def health():
    return {
        "status":           "healthy",
        "customers_loaded": len(customers_df),
        "products_loaded":  len(products_df),
        "rules_loaded":     len(rules_df),
        "models": {
            "kmeans_customers": "loaded",
            "kmeans_products":  "loaded",
            "apriori_rules":    "loaded",
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER SEGMENTATION
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/segment/customer", tags=["Customer Segmentation"])
def segment_customer(request: CustomerRFMRequest):
    try:
        X = customer_scaler.transform(
            [[request.recency, request.frequency, request.monetary]]
        )
        cluster_id = int(customer_model.predict(X)[0])
        segment    = CUSTOMER_LABELS.get(cluster_id, f"Cluster {cluster_id}")
        action     = CUSTOMER_ACTIONS.get(segment, "")
        return {
            "segment":    segment,
            "cluster_id": cluster_id,
            "inputs": {
                "recency":   request.recency,
                "frequency": request.frequency,
                "monetary":  request.monetary,
            },
            "marketing_action": action,
            "segment_description": {
                "Champions": "Recently purchased, buys often, high spender.",
                "Loyal":     "Buys regularly, good frequency, decent spend.",
                "At-Risk":   "Used to buy but hasn't recently. Needs attention.",
                "Lost":      "Hasn't purchased in a long time. Very low activity.",
            }.get(segment, ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/segment/customer/{customer_id}", tags=["Customer Segmentation"])
def get_customer_segment(customer_id: str):
    customer = customers_df[customers_df["CustomerID"] == customer_id]
    if customer.empty:
        raise HTTPException(status_code=404, detail=f"Customer ID '{customer_id}' not found.")
    row     = customer.iloc[0]
    segment = str(row.get("Segment", "Unknown"))
    return {
        "customer_id":      customer_id,
        "segment":          segment,
        "recency":          round(float(row["Recency"]),  2),
        "frequency":        int(row["Frequency"]),
        "monetary":         round(float(row["Monetary"]), 2),
        "marketing_action": CUSTOMER_ACTIONS.get(segment, ""),
    }


@app.get("/segments/customers/summary", tags=["Customer Segmentation"])
def customer_segments_summary():
    summary = customers_df["Segment"].value_counts().to_dict()
    total   = len(customers_df)
    return {
        "total_customers": total,
        "segments": {
            seg: {
                "count":      count,
                "percentage": round(count / total * 100, 1),
                "action":     CUSTOMER_ACTIONS.get(seg, ""),
            }
            for seg, count in summary.items()
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# BASKET RECOMMENDATIONS (APRIORI)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/recommend/basket/{product_name}", tags=["Product Recommendations"])
def basket_recommendations(product_name: str, top_n: int = 5):
    mask    = rules_df["antecedents_str"].str.contains(product_name, case=False, na=False)
    matches = rules_df[mask].sort_values("lift", ascending=False).head(top_n)
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"No rules found for '{product_name}'.")
    return {
        "product":         product_name,
        "total_rules":     len(matches),
        "recommendations": [
            {
                "rank":                i + 1,
                "recommended_product": row["consequents_str"],
                "confidence":          round(float(row["confidence"]), 3),
                "lift":                round(float(row["lift"]),       3),
                "support":             round(float(row["support"]),    4),
                "interpretation": (
                    f"Customers who buy '{row['antecedents_str']}' are "
                    f"{round(float(row['lift']), 1)}x more likely to also buy "
                    f"'{row['consequents_str']}'"
                ),
            }
            for i, (_, row) in enumerate(matches.iterrows())
        ],
    }


@app.get("/recommend/basket", tags=["Product Recommendations"])
def list_recommendable_products():
    products = sorted(rules_df["antecedents_str"].unique().tolist())
    return {"total": len(products), "products": products}


# ══════════════════════════════════════════════════════════════════════════════
# PRODUCT CLUSTERING
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/segment/product", tags=["Product Clustering"])
def segment_product(request: ProductRequest):
    try:
        X = product_scaler.transform([[
            request.avg_price, request.total_quantity,
            request.num_transactions, request.num_customers,
            request.total_revenue,
        ]])
        cluster_id = int(product_model.predict(X)[0])
        segment    = PRODUCT_LABELS.get(cluster_id, f"Cluster {cluster_id}")
        return {
            "segment":    segment,
            "cluster_id": cluster_id,
            "inputs":     request.dict(),
            "seller_action": PRODUCT_ACTIONS.get(segment, ""),
            "segment_description": {
                "Premium":  "High price, low volume. Exclusive item.",
                "Trending": "High sales velocity, broadly purchased.",
                "Budget":   "Low price, decent volume. Mass market item.",
                "Niche":    "High quantity but specific buyer group.",
            }.get(segment, ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/segments/products/summary", tags=["Product Clustering"])
def product_segments_summary():
    summary = products_df["Segment"].value_counts().to_dict()
    total   = len(products_df)
    return {
        "total_products": total,
        "segments": {
            seg: {
                "count":      count,
                "percentage": round(count / total * 100, 1),
                "action":     PRODUCT_ACTIONS.get(seg, ""),
            }
            for seg, count in summary.items()
        }
    }


@app.get("/segments/products/{segment}", tags=["Product Clustering"])
def get_products_by_segment(segment: str, limit: int = 20):
    valid = ["Premium", "Trending", "Budget", "Niche"]
    if segment not in valid:
        raise HTTPException(status_code=400, detail=f"Choose from: {valid}")
    filtered = products_df[products_df["Segment"] == segment].head(limit)
    if filtered.empty:
        raise HTTPException(status_code=404, detail=f"No products in '{segment}'")
    return {
        "segment":  segment,
        "count":    len(filtered),
        "action":   PRODUCT_ACTIONS.get(segment, ""),
        "products": filtered[["Description", "avg_price", "total_quantity",
                               "num_transactions", "num_customers",
                               "total_revenue"]].to_dict("records"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# BUSINESS INSIGHTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/insights/overview", tags=["Business Insights"])
def business_overview():
    customer_summary = customers_df["Segment"].value_counts().to_dict()
    total_customers  = len(customers_df)
    total_revenue    = round(float(customers_df["Monetary"].sum()), 2)
    avg_order_value  = round(float(customers_df["Monetary"].mean()), 2)
    product_summary  = products_df["Segment"].value_counts().to_dict()
    total_products   = len(products_df)
    top_rules        = rules_df.head(5)[
        ["antecedents_str", "consequents_str", "lift", "confidence"]
    ].to_dict("records")

    return {
        "business_metrics": {
            "total_customers":   total_customers,
            "total_revenue_gbp": total_revenue,
            "avg_order_value":   avg_order_value,
            "total_products":    total_products,
            "total_rules":       len(rules_df),
        },
        "customer_segments": {
            seg: {"count": cnt, "percentage": round(cnt / total_customers * 100, 1)}
            for seg, cnt in customer_summary.items()
        },
        "product_segments": {
            seg: {"count": cnt, "percentage": round(cnt / total_products * 100, 1)}
            for seg, cnt in product_summary.items()
        },
        "top_association_rules": top_rules,
    }


@app.get("/insights/top-customers", tags=["Business Insights"])
def top_customers(limit: int = 10):
    top = (customers_df[customers_df["Segment"] == "Champions"]
           .sort_values("Monetary", ascending=False).head(limit))
    return {
        "segment":   "Champions",
        "count":     len(top),
        "customers": top[["CustomerID", "Recency", "Frequency",
                           "Monetary", "Segment"]].to_dict("records")
    }


@app.get("/insights/top-products", tags=["Business Insights"])
def top_products(limit: int = 10):
    top = products_df.sort_values("total_revenue", ascending=False).head(limit)
    return {
        "count":    len(top),
        "products": top[["Description", "avg_price", "total_quantity",
                          "total_revenue", "Segment"]].to_dict("records")
    }


@app.get("/insights/simulate", tags=["Business Insights"])
def simulate_new_order():
    """Simulates a new incoming order — for live demo purposes."""
    return {
        "new_order": True,
        "product": random.choice([
            "JUMBO BAG RED RETROSPOT",
            "WHITE HANGING HEART T-LIGHT HOLDER",
            "REGENCY CAKESTAND 3 TIER",
            "PARTY BUNTING",
            "LUNCH BAG RED RETROSPOT",
        ]),
        "customer_segment": random.choice(["Champions", "Loyal", "At-Risk", "Lost"]),
        "amount":    round(random.uniform(10, 500), 2),
        "quantity":  random.randint(1, 10),
        "timestamp": str(datetime.now()),
        "message":   "New order received! 🛒"
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/admin/stats", tags=["Admin"])
def admin_stats(token: str, db: Session = Depends(get_db)):
    """Admin only — full system stats + all users."""
    payload = auth.decode_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only.")

    from models import User
    users = db.query(User).all()

    return {
        "total_users": len(users),
        "users": [
            {
                "id":         u.id,
                "name":       u.name,
                "email":      u.email,
                "role":       u.role,
                "is_active":  u.is_active,
                "created_at": str(u.created_at),
            }
            for u in users
        ],
        "system": {
            "customers_loaded": len(customers_df),
            "products_loaded":  len(products_df),
            "rules_loaded":     len(rules_df),
            "models": {
                "kmeans_customers": "loaded",
                "kmeans_products":  "loaded",
                "apriori_rules":    "loaded",
            }
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# RUN SERVER
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  🚀 Starting E-Commerce AI API Server")
    print("=" * 60)
    print("  Swagger UI → http://127.0.0.1:8000/docs")
    print("  API Root   → http://127.0.0.1:8000")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
