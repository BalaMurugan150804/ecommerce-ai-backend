
# ── Imports ────────────────────────────────────────────────────────────────────
import os
import warnings
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import joblib

warnings.filterwarnings("ignore")

# ── Configuration ──────────────────────────────────────────────────────────────
DATA_PATH   = "data/online_retail_II.xlsx"
SHEET_NAME  = "Year 2010-2011"
MODEL_DIR   = "models"
OUTPUT_DIR  = "outputs"
K_RANGE     = range(2, 11)
FINAL_K     = 4
RANDOM_SEED = 42

# Cluster label mapping — update after seeing your centroid summary
# Rule:
#   Premium  = High price, low-medium volume
#   Trending = High volume, medium price
#   Budget   = Low price, high volume
#   Niche    = Low volume, low transactions (specialist items)
CLUSTER_LABELS = {
    0: "Budget",      # lowest price, low volume
    1: "Trending",    # medium volume, decent transactions
    2: "Premium",     # highest price £744 avg!
    3: "Niche",       # highest quantity but very few customers — bulk/wholesale
}

CLUSTER_COLORS = {
    "Premium":  "#8b5cf6",
    "Trending": "#10b981",
    "Budget":   "#0ea5e9",
    "Niche":    "#f59e0b",
}

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Load & Clean Data
# ══════════════════════════════════════════════════════════════════════════════

def load_and_clean(path: str, sheet: str) -> pd.DataFrame:
    print("\n[1/6] Loading dataset …")
    df = pd.read_excel(path, sheet_name=sheet, dtype={"Customer ID": str})

    # Normalise column names
    df.columns = df.columns.str.strip().str.replace(" ", "")
    rename_map = {
        "Invoice":     "InvoiceNo",
        "StockCode":   "StockCode",
        "Description": "Description",
        "Quantity":    "Quantity",
        "InvoiceDate": "InvoiceDate",
        "Price":       "UnitPrice",
        "CustomerID":  "CustomerID",
        "Country":     "Country",
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns},
              inplace=True)

    # Remove cancelled invoices
    df = df[~df["InvoiceNo"].astype(str).str.startswith("C")]

    # Remove bad rows
    df = df[(df["Quantity"] > 0) & (df["UnitPrice"] > 0)]
    df.dropna(subset=["Description", "CustomerID"], inplace=True)
    df["Description"] = df["Description"].str.strip().str.upper()
    df["TotalRevenue"] = df["Quantity"] * df["UnitPrice"]

    print(f"      Clean rows : {len(df):,}")
    print(f"      Unique products: {df['Description'].nunique():,}")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Feature Engineering: Product Features
# ══════════════════════════════════════════════════════════════════════════════

def build_product_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute 5 features per product:

    avg_price         = average unit price across all transactions
    total_quantity    = total units sold
    num_transactions  = number of invoices the product appeared in
    num_customers     = number of unique customers who bought it
    total_revenue     = total revenue generated (£)

    These 5 features let K-Means separate products into meaningful groups.
    """
    print("\n[2/6] Engineering product features …")

    product_features = (
        df.groupby("Description")
        .agg(
            avg_price        =("UnitPrice",    "mean"),
            total_quantity   =("Quantity",     "sum"),
            num_transactions =("InvoiceNo",    "nunique"),
            num_customers    =("CustomerID",   "nunique"),
            total_revenue    =("TotalRevenue", "sum"),
        )
        .reset_index()
    )

    # Remove extreme outliers (top 1% by revenue) — they distort clustering
    revenue_cap = product_features["total_revenue"].quantile(0.99)
    product_features = product_features[
        product_features["total_revenue"] <= revenue_cap
    ]

    # Keep only products with at least 10 transactions (removes junk entries)
    product_features = product_features[
        product_features["num_transactions"] >= 10
    ]

    print(f"      Products after filtering: {len(product_features):,}")
    print("\n      Feature summary:")
    print(product_features[["avg_price", "total_quantity",
                             "num_transactions", "num_customers",
                             "total_revenue"]].describe().round(2).to_string())

    return product_features


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Preprocessing
# ══════════════════════════════════════════════════════════════════════════════

def preprocess(product_features: pd.DataFrame):
    """Scale features with StandardScaler before K-Means."""
    print("\n[3/6] Scaling product features …")

    feature_cols = ["avg_price", "total_quantity",
                    "num_transactions", "num_customers", "total_revenue"]

    scaler = StandardScaler()
    X = scaler.fit_transform(product_features[feature_cols])

    joblib.dump(scaler, f"{MODEL_DIR}/product_scaler.pkl")
    print(f"      Scaler saved → {MODEL_DIR}/product_scaler.pkl")

    return X, scaler, feature_cols


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Find Optimal K
# ══════════════════════════════════════════════════════════════════════════════

def find_optimal_k(X: np.ndarray) -> None:
    print(f"\n[4/6] Running elbow + silhouette for K = {K_RANGE.start}…{K_RANGE.stop-1} …")

    inertias, sil_scores = [], []

    for k in K_RANGE:
        km = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init=10)
        labels = km.fit_predict(X)
        inertias.append(km.inertia_)
        sil_scores.append(silhouette_score(X, labels))
        print(f"      K={k}  inertia={km.inertia_:,.0f}  silhouette={sil_scores[-1]:.4f}")

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Product Clustering — Optimal K Selection",
                 fontsize=14, fontweight="bold")

    axes[0].plot(list(K_RANGE), inertias, marker="o",
                 color="#8b5cf6", linewidth=2, markersize=7)
    axes[0].axvline(FINAL_K, color="#f43f5e", linestyle="--",
                    linewidth=1.5, label=f"Chosen K = {FINAL_K}")
    axes[0].set_title("Elbow Curve (Inertia)")
    axes[0].set_xlabel("Number of Clusters (K)")
    axes[0].set_ylabel("Inertia (WCSS)")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(list(K_RANGE), sil_scores, marker="s",
                 color="#10b981", linewidth=2, markersize=7)
    axes[1].axvline(FINAL_K, color="#f43f5e", linestyle="--",
                    linewidth=1.5, label=f"Chosen K = {FINAL_K}")
    axes[1].set_title("Silhouette Score")
    axes[1].set_xlabel("Number of Clusters (K)")
    axes[1].set_ylabel("Silhouette Score")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    p = f"{OUTPUT_DIR}/10_product_elbow_silhouette.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Train K-Means
# ══════════════════════════════════════════════════════════════════════════════

def train_kmeans(X: np.ndarray,
                 product_features: pd.DataFrame) -> pd.DataFrame:
    print(f"\n[5/6] Training K-Means with K = {FINAL_K} …")

    km = KMeans(n_clusters=FINAL_K, random_state=RANDOM_SEED,
                n_init=10, max_iter=300)
    product_features["Cluster"] = km.fit_predict(X)

    joblib.dump(km, f"{MODEL_DIR}/kmeans_products.pkl")
    print(f"      Model saved → {MODEL_DIR}/kmeans_products.pkl")

    # Centroid summary in original scale
    centroid_summary = product_features.groupby("Cluster")[
        ["avg_price", "total_quantity", "num_transactions",
         "num_customers", "total_revenue"]
    ].mean().round(2)

    print("\n      Cluster centroid means (original scale):")
    print(centroid_summary.to_string())
    print("\n      ⚠️  Check the centroid summary above and update")
    print("         CLUSTER_LABELS in config if needed.")
    print("         Premium  = highest avg_price")
    print("         Trending = highest total_quantity / num_transactions")
    print("         Budget   = lowest avg_price, decent volume")
    print("         Niche    = lowest num_transactions & num_customers")

    product_features["Segment"] = product_features["Cluster"].map(CLUSTER_LABELS)

    seg_counts = product_features["Segment"].value_counts()
    print("\n      Segment distribution:")
    print(seg_counts.to_string())

    return product_features, km


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Visualise & Save
# ══════════════════════════════════════════════════════════════════════════════

def visualise_and_save(product_features: pd.DataFrame) -> None:
    print("\n[6/6] Generating visualisations …")

    seg_order = list(CLUSTER_LABELS.values())
    palette   = {s: CLUSTER_COLORS[s] for s in seg_order}

    # ── Plot 1: Segment distribution bar chart ────────────────────────────────
    fig, ax = plt.subplots(figsize=(8, 5))
    seg_counts = product_features["Segment"].value_counts()
    seg_counts_ordered = seg_counts.reindex(seg_order, fill_value=0)
    bar_colors = [CLUSTER_COLORS[s] for s in seg_counts_ordered.index]
    bars = ax.bar(seg_counts_ordered.index, seg_counts_ordered.values,
                  color=bar_colors, edgecolor="white", linewidth=0.8)
    for bar, val in zip(bars, seg_counts_ordered.values):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 2,
                f"{val:,}\n({val/len(product_features)*100:.1f}%)",
                ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_title("Product Segments — K-Means Clustering",
                 fontsize=13, fontweight="bold")
    ax.set_xlabel("Segment")
    ax.set_ylabel("Number of Products")
    ax.set_ylim(0, seg_counts_ordered.max() * 1.25)
    ax.grid(axis="y", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/11_product_segment_distribution.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this")

    # ── Plot 2: Avg Price vs Total Revenue scatter ────────────────────────────
    fig, ax = plt.subplots(figsize=(10, 6))
    for seg, grp in product_features.groupby("Segment"):
        ax.scatter(grp["avg_price"], grp["total_revenue"] / 1000,
                   label=seg, color=CLUSTER_COLORS[seg],
                   alpha=0.6, s=40, edgecolors="white", linewidth=0.3)
    ax.set_xlabel("Average Unit Price (£)", fontsize=11)
    ax.set_ylabel("Total Revenue (£ thousands)", fontsize=11)
    ax.set_title("Product Clusters — Price vs Revenue",
                 fontsize=13, fontweight="bold")
    ax.legend(title="Segment")
    ax.grid(True, alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/12_product_price_vs_revenue.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this")

    # ── Plot 3: Box plots — Price & Quantity per segment ──────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Product Feature Distribution by Segment",
                 fontsize=13, fontweight="bold")

    sns.boxplot(data=product_features, x="Segment", y="avg_price",
                order=seg_order, palette=palette,
                ax=axes[0], linewidth=1.2, fliersize=3)
    axes[0].set_title("Average Unit Price (£)")
    axes[0].set_xlabel("")
    axes[0].tick_params(axis="x", rotation=15)
    axes[0].grid(axis="y", alpha=0.3)
    axes[0].spines[["top", "right"]].set_visible(False)

    sns.boxplot(data=product_features, x="Segment", y="total_quantity",
                order=seg_order, palette=palette,
                ax=axes[1], linewidth=1.2, fliersize=3)
    axes[1].set_title("Total Quantity Sold")
    axes[1].set_xlabel("")
    axes[1].tick_params(axis="x", rotation=15)
    axes[1].grid(axis="y", alpha=0.3)
    axes[1].spines[["top", "right"]].set_visible(False)

    plt.tight_layout()
    p = f"{OUTPUT_DIR}/13_product_boxplots.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this")

    # ── Plot 4: Heatmap — normalised feature scores per segment ──────────────
    feature_cols = ["avg_price", "total_quantity",
                    "num_transactions", "num_customers", "total_revenue"]
    summary = product_features.groupby("Segment")[feature_cols].mean()
    summary_norm = (summary - summary.min()) / (summary.max() - summary.min())

    fig, ax = plt.subplots(figsize=(9, 4))
    sns.heatmap(summary_norm.loc[seg_order], annot=True, fmt=".2f",
                cmap="YlOrRd", linewidths=0.5, ax=ax,
                cbar_kws={"label": "Score (0=low, 1=high)"},
                xticklabels=["Avg Price", "Qty Sold",
                             "Transactions", "Customers", "Revenue"])
    ax.set_title("Product Segment Heatmap — Normalised Feature Scores",
                 fontsize=12, fontweight="bold")
    ax.set_ylabel("")
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/14_product_heatmap.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this")

    # ── Plot 5: Top 10 products per segment ───────────────────────────────────
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle("Top 10 Products by Revenue — Per Segment",
                 fontsize=14, fontweight="bold")

    for ax, seg in zip(axes.flatten(), seg_order):
        grp = (
            product_features[product_features["Segment"] == seg]
            .nlargest(10, "total_revenue")
        )
        bars = ax.barh(grp["Description"].str[:40],
                       grp["total_revenue"] / 1000,
                       color=CLUSTER_COLORS[seg],
                       edgecolor="white", linewidth=0.5)
        ax.invert_yaxis()
        ax.set_title(f"{seg} Segment", fontsize=12,
                     fontweight="bold", color=CLUSTER_COLORS[seg])
        ax.set_xlabel("Total Revenue (£ thousands)")
        ax.grid(axis="x", alpha=0.3)
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(axis="y", labelsize=8)

    plt.tight_layout()
    p = f"{OUTPUT_DIR}/15_top_products_per_segment.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this")

    # ── Export segmented products to CSV ──────────────────────────────────────
    out_csv = f"{OUTPUT_DIR}/products_segmented.csv"
    product_features.to_csv(out_csv, index=False)
    print(f"\n      ✓ Segmented product data → {out_csv}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Inference Helper (used by FastAPI later)
# ══════════════════════════════════════════════════════════════════════════════

def predict_product_segment(avg_price: float,
                             total_quantity: int,
                             num_transactions: int,
                             num_customers: int,
                             total_revenue: float) -> dict:
    """
    Load saved scaler + model and predict segment for a product.
    Call this from your FastAPI endpoint:

        from kmeans_product_clustering import predict_product_segment
        result = predict_product_segment(
            avg_price=2.95, total_quantity=5000,
            num_transactions=800, num_customers=600,
            total_revenue=14750.0
        )
    """
    scaler = joblib.load(f"{MODEL_DIR}/product_scaler.pkl")
    model  = joblib.load(f"{MODEL_DIR}/kmeans_products.pkl")

    X_new = scaler.transform([[avg_price, total_quantity,
                                num_transactions, num_customers,
                                total_revenue]])
    cluster_id = int(model.predict(X_new)[0])
    segment    = CLUSTER_LABELS.get(cluster_id, f"Cluster {cluster_id}")

    return {
        "cluster_id": cluster_id,
        "segment":    segment,
        "seller_action": {
            "Premium":  "Highlight as exclusive. Target Champions segment customers.",
            "Trending": "Feature on homepage. Push notifications to all segments.",
            "Budget":   "Bundle with Premium products. Good for At-Risk win-back offers.",
            "Niche":    "Target to specific loyal customer groups. Avoid mass promotion.",
        }.get(segment, "No action defined.")
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  K-Means Product Clustering")
    print("  UCI Online Retail II Dataset")
    print("=" * 60)

    # 1. Load
    df = load_and_clean(DATA_PATH, SHEET_NAME)

    # 2. Product features
    product_features = build_product_features(df)

    # 3. Scale
    X, scaler, feature_cols = preprocess(product_features)

    # 4. Elbow
    find_optimal_k(X)

    # 5. Train
    product_features, km = train_kmeans(X, product_features)

    # 6. Visualise
    visualise_and_save(product_features)

    # 7. Inference demo
    print("\n── Inference demo ─────────────────────────────────────")
    demo = predict_product_segment(
        avg_price=2.95, total_quantity=5000,
        num_transactions=800, num_customers=600,
        total_revenue=14750.0
    )
    print(f"   Segment    : {demo['segment']}  (cluster {demo['cluster_id']})")
    print(f"   Seller tip : {demo['seller_action']}")

    print("\n✅ All done!")
    print(f"   Models  → {MODEL_DIR}/kmeans_products.pkl")
    print(f"   Plots   → {OUTPUT_DIR}/  (plots 10–15)")
    print(f"   CSV     → {OUTPUT_DIR}/products_segmented.csv")
    print("\n🎉 ALL 3 ML MODULES COMPLETE!")
    print("   K-Means Customers ✅  |  Apriori ✅  |  K-Means Products ✅")


if __name__ == "__main__":
    main()
