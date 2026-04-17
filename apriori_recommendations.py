

# ── Imports ────────────────────────────────────────────────────────────────────
import os
import warnings
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

warnings.filterwarnings("ignore")

# ── Configuration ──────────────────────────────────────────────────────────────
DATA_PATH    = "data/online_retail_II.xlsx"
SHEET_NAME   = "Year 2010-2011"
MODEL_DIR    = "models"
OUTPUT_DIR   = "outputs"

MIN_SUPPORT    = 0.03    # item set must appear in at least 2% of transactions
MIN_CONFIDENCE = 0.3     # if A bought → B bought at least 50% of the time
MIN_LIFT       = 1.0     # association must be 1.5x stronger than by chance
TOP_N_RULES    = 20      # how many top rules to display in plots

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Load & Clean Data
# ══════════════════════════════════════════════════════════════════════════════

def load_and_clean(path: str, sheet: str) -> pd.DataFrame:
    """Load UCI Online Retail II and return cleaned DataFrame."""
    print("\n[1/6] Loading dataset …")
    df = pd.read_excel(path, sheet_name=sheet, dtype={"Customer ID": str})

    # Normalise column names
    df.columns = df.columns.str.strip().str.replace(" ", "")
    rename_map = {
        "Invoice":    "InvoiceNo",
        "StockCode":  "StockCode",
        "Description":"Description",
        "Quantity":   "Quantity",
        "InvoiceDate":"InvoiceDate",
        "Price":      "UnitPrice",
        "CustomerID": "CustomerID",
        "Country":    "Country",
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns},
              inplace=True)

    print(f"      Raw rows: {len(df):,}")

    # Remove cancelled invoices
    cancelled = df["InvoiceNo"].astype(str).str.startswith("C")
    df = df[~cancelled]
    print(f"      Removed {cancelled.sum():,} cancelled invoices")

    # Remove bad rows
    df = df[df["Quantity"] > 0]
    df = df[df["UnitPrice"] > 0]
    df.dropna(subset=["Description"], inplace=True)
    df["Description"] = df["Description"].str.strip()

    print(f"      Clean rows: {len(df):,}")
    print(f"      Unique products: {df['Description'].nunique():,}")
    print(f"      Unique invoices: {df['InvoiceNo'].nunique():,}")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Build Basket Matrix
# ══════════════════════════════════════════════════════════════════════════════

def build_basket_matrix(df: pd.DataFrame):
    
    print("\n[2/6] Building basket matrix …")

    # Group items per invoice
    basket = (
        df.groupby(["InvoiceNo", "Description"])["Quantity"]
        .sum()
        .unstack(fill_value=0)
    )

    # Encode: 1 if bought (quantity > 0), else 0
    basket = basket.map(lambda x: 1 if x > 0 else 0)

    print(f"      Basket matrix shape: {basket.shape[0]:,} invoices × {basket.shape[1]:,} products")

    # Filter: keep only products that appear in at least 100 invoices
    # This speeds up Apriori significantly
    min_invoice_count = 100
    product_counts = basket.sum(axis=0)
    basket = basket.loc[:, product_counts >= min_invoice_count]
    # Also limit to top 500 most common products to save memory
    top_products = product_counts[product_counts >= min_invoice_count].nlargest(500).index
    basket = basket[top_products]
    print(f"      After filtering rare products: {basket.shape[1]:,} products remain")
    return basket


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Run Apriori Algorithm
# ══════════════════════════════════════════════════════════════════════════════

def run_apriori(basket: pd.DataFrame) -> pd.DataFrame:
    
    print(f"\n[3/6] Running Apriori (min_support={MIN_SUPPORT}) …")
    print(f"      This may take 1–2 minutes …")

    frequent_itemsets = apriori(
        basket,
        min_support=MIN_SUPPORT,
        use_colnames=True,
        max_len=3          # max 3 items per itemset (keeps it fast)
    )

    frequent_itemsets["length"] = frequent_itemsets["itemsets"].apply(len)

    print(f"      Frequent itemsets found: {len(frequent_itemsets):,}")
    print(f"      Itemsets by size:")
    print(frequent_itemsets["length"].value_counts().sort_index().to_string())

    return frequent_itemsets


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Generate Association Rules
# ══════════════════════════════════════════════════════════════════════════════

def generate_rules(frequent_itemsets: pd.DataFrame) -> pd.DataFrame:
    """
    Extract association rules from frequent itemsets.

    Key metrics:
    - Support    = how often A+B appear together
    - Confidence = P(B | A) — if A bought, probability B also bought
    - Lift       = how much more likely B is bought with A vs randomly
                   Lift > 1 = real association
                   Lift > 1.5 = strong association (our threshold)
    """
    print(f"\n[4/6] Generating association rules …")

    rules = association_rules(
        frequent_itemsets,
        metric="lift",
        min_threshold=MIN_LIFT
    )

    # Apply confidence filter
    rules = rules[rules["confidence"] >= MIN_CONFIDENCE]

    # Clean up columns
    rules["antecedents_str"] = rules["antecedents"].apply(
        lambda x: ", ".join(list(x))
    )
    rules["consequents_str"] = rules["consequents"].apply(
        lambda x: ", ".join(list(x))
    )

    # Sort by lift (strongest associations first)
    rules = rules.sort_values("lift", ascending=False).reset_index(drop=True)

    print(f"      Total rules generated: {len(rules):,}")
    print(f"      Rules with lift > 2.0: {len(rules[rules['lift'] > 2.0]):,}")
    print(f"      Rules with lift > 3.0: {len(rules[rules['lift'] > 3.0]):,}")

    # Show top 10 rules
    print(f"\n      Top 10 Association Rules:")
    print(f"      {'Antecedent':<40} {'Consequent':<35} {'Supp':>6} {'Conf':>6} {'Lift':>6}")
    print(f"      {'-'*97}")
    for _, row in rules.head(10).iterrows():
        ant = row["antecedents_str"][:38]
        con = row["consequents_str"][:33]
        print(f"      {ant:<40} {con:<35} {row['support']:>6.3f} {row['confidence']:>6.3f} {row['lift']:>6.2f}")

    return rules


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Save Rules
# ══════════════════════════════════════════════════════════════════════════════

def save_rules(rules: pd.DataFrame) -> None:
    """Save association rules to CSV for use by FastAPI."""
    out_path = f"{MODEL_DIR}/association_rules.csv"
    rules[["antecedents_str", "consequents_str",
           "support", "confidence", "lift"]].to_csv(out_path, index=False)
    print(f"\n[5/6] Rules saved → {out_path}")
    print(f"      FastAPI will load this file to serve recommendations")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Visualise Results
# ══════════════════════════════════════════════════════════════════════════════

def visualise(rules: pd.DataFrame, frequent_itemsets: pd.DataFrame) -> None:
    """Generate 4 review-ready plots."""
    print(f"\n[6/6] Generating visualisations …")

    top_rules = rules.head(TOP_N_RULES).copy()

    # ── Plot 1: Top N Rules — Lift bar chart ──────────────────────────────────
    fig, ax = plt.subplots(figsize=(12, 8))
    labels = [f"{row['antecedents_str'][:30]}  →  {row['consequents_str'][:25]}"
              for _, row in top_rules.iterrows()]
    lift_vals = top_rules["lift"].astype(float).values
    lift_norm = (lift_vals - lift_vals.min()) / (lift_vals.max() - lift_vals.min() + 1e-9)
    colors = plt.cm.RdYlGn(lift_norm)
    
    bars = ax.barh(range(len(top_rules)), top_rules["lift"],
                   color=colors, edgecolor="white", linewidth=0.5)
    ax.set_yticks(range(len(top_rules)))
    ax.set_yticklabels(labels, fontsize=8)
    ax.invert_yaxis()
    ax.set_xlabel("Lift Score", fontsize=11)
    ax.set_title(f"Top {TOP_N_RULES} Association Rules by Lift\n"
                 f"(min_support={MIN_SUPPORT}, min_confidence={MIN_CONFIDENCE})",
                 fontsize=13, fontweight="bold")
    ax.axvline(MIN_LIFT, color="#f43f5e", linestyle="--",
               linewidth=1.5, label=f"Min lift = {MIN_LIFT}")
    ax.legend()
    ax.grid(axis="x", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    for bar, val in zip(bars, top_rules["lift"]):
        ax.text(bar.get_width() + 0.05, bar.get_y() + bar.get_height() / 2,
                f"{val:.2f}", va="center", fontsize=8)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/06_top_rules_lift.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Plot 2: Support vs Confidence scatter (coloured by Lift) ──────────────
    fig, ax = plt.subplots(figsize=(10, 7))
    scatter = ax.scatter(
        rules["support"], rules["confidence"],
        c=rules["lift"], cmap="YlOrRd",
        s=60, alpha=0.7, edgecolors="white", linewidth=0.4
    )
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label("Lift", fontsize=11)
    ax.set_xlabel("Support", fontsize=11)
    ax.set_ylabel("Confidence", fontsize=11)
    ax.set_title("Association Rules — Support vs Confidence\n(colour = Lift strength)",
                 fontsize=13, fontweight="bold")
    ax.axhline(MIN_CONFIDENCE, color="#0ea5e9", linestyle="--",
               linewidth=1.2, label=f"Min confidence = {MIN_CONFIDENCE}")
    ax.axvline(MIN_SUPPORT, color="#8b5cf6", linestyle="--",
               linewidth=1.2, label=f"Min support = {MIN_SUPPORT}")
    ax.legend()
    ax.grid(True, alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/07_support_confidence_scatter.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Plot 3: Top 15 most frequent single items ─────────────────────────────
    single_items = frequent_itemsets[frequent_itemsets["length"] == 1].copy()
    single_items["item"] = single_items["itemsets"].apply(lambda x: list(x)[0])
    single_items = single_items.nlargest(15, "support")

    fig, ax = plt.subplots(figsize=(11, 6))
    bars = ax.barh(single_items["item"], single_items["support"] * 100,
                   color="#0ea5e9", edgecolor="white", linewidth=0.5)
    ax.invert_yaxis()
    ax.set_xlabel("Support (%)", fontsize=11)
    ax.set_title("Top 15 Most Frequently Purchased Products",
                 fontsize=13, fontweight="bold")
    for bar, val in zip(bars, single_items["support"] * 100):
        ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height() / 2,
                f"{val:.1f}%", va="center", fontsize=9)
    ax.grid(axis="x", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/08_top_products_frequency.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Plot 4: Heatmap of top rules (antecedent vs consequent) ───────────────
    top15 = rules.head(15).copy()
    pivot_data = top15.pivot_table(
        index="antecedents_str",
        columns="consequents_str",
        values="lift",
        aggfunc="max"
    ).fillna(0)

    # Truncate long names for readability
    pivot_data.index   = [i[:35] for i in pivot_data.index]
    pivot_data.columns = [c[:30] for c in pivot_data.columns]

    fig, ax = plt.subplots(figsize=(14, 8))
    sns.heatmap(pivot_data, annot=True, fmt=".1f", cmap="YlOrRd",
                linewidths=0.5, ax=ax,
                cbar_kws={"label": "Lift Score"},
                annot_kws={"size": 8})
    ax.set_title("Association Rules Heatmap — Lift Scores\n(If row bought → column recommended)",
                 fontsize=13, fontweight="bold")
    ax.set_xlabel("Consequent (Recommended Product)", fontsize=10)
    ax.set_ylabel("Antecedent (Viewed/Bought Product)", fontsize=10)
    ax.tick_params(axis="x", rotation=30, labelsize=8)
    ax.tick_params(axis="y", rotation=0,  labelsize=8)
    plt.tight_layout()
    p = f"{OUTPUT_DIR}/09_rules_heatmap.png"
    plt.savefig(p, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"      ✓ Saved → {p}  ← Screenshot this for Review 2")

    # ── Export top rules to readable CSV ──────────────────────────────────────
    export = rules[["antecedents_str", "consequents_str",
                    "support", "confidence", "lift"]].head(50)
    export.columns = ["If customer buys", "Recommend",
                      "Support", "Confidence", "Lift"]
    export.to_csv(f"{OUTPUT_DIR}/top50_association_rules.csv", index=False)
    print(f"\n      ✓ Top 50 rules exported → {OUTPUT_DIR}/top50_association_rules.csv")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Inference Helper (used by FastAPI later)
# ══════════════════════════════════════════════════════════════════════════════

def get_recommendations(product_name: str, top_n: int = 5) -> dict:
    """
    Load saved rules and return recommendations for a given product.
    Call this from your FastAPI endpoint:

        from apriori_recommendations import get_recommendations
        result = get_recommendations("WHITE HANGING HEART T-LIGHT HOLDER")
    """
    rules_df = pd.read_csv(f"{MODEL_DIR}/association_rules.csv")

    # Find rules where antecedent contains the product
    mask = rules_df["antecedents_str"].str.contains(
        product_name, case=False, na=False
    )
    matches = rules_df[mask].sort_values("lift", ascending=False).head(top_n)

    if matches.empty:
        return {
            "product": product_name,
            "recommendations": [],
            "message": "No association rules found for this product."
        }

    recommendations = []
    for _, row in matches.iterrows():
        recommendations.append({
            "recommended_product": row["consequents_str"],
            "confidence": round(row["confidence"], 3),
            "lift":       round(row["lift"], 3),
            "support":    round(row["support"], 4),
        })

    return {
        "product":        product_name,
        "recommendations": recommendations,
        "message":        f"Found {len(recommendations)} frequently bought together items."
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  Apriori Association Rule Mining")
    print("  UCI Online Retail II Dataset")
    print("=" * 60)

    # 1. Load
    df = load_and_clean(DATA_PATH, SHEET_NAME)

    # 2. Basket matrix
    basket = build_basket_matrix(df)

    # 3. Frequent itemsets
    frequent_itemsets = run_apriori(basket)

    # 4. Association rules
    rules = generate_rules(frequent_itemsets)

    # 5. Save rules
    save_rules(rules)

    # 6. Visualise
    visualise(rules, frequent_itemsets)

    # 7. Quick inference demo
    print("\n── Inference demo ─────────────────────────────────────")
    # Get the most common product from rules to demo
    sample_product = rules["antecedents_str"].iloc[0]
    result = get_recommendations(sample_product)
    print(f"\n   Product: {result['product']}")
    print(f"   {result['message']}")
    for i, rec in enumerate(result["recommendations"], 1):
        print(f"   {i}. {rec['recommended_product']}")
        print(f"      Confidence={rec['confidence']}  Lift={rec['lift']}")

    print("\n✅ All done!")
    print(f"   Rules    → {MODEL_DIR}/association_rules.csv")
    print(f"   Plots    → {OUTPUT_DIR}/  (4 PNG files — screenshots 6 to 9)")
    print(f"   CSV      → {OUTPUT_DIR}/top50_association_rules.csv")
    print("\nYou now have BOTH K-Means + Apriori complete! 🎉")


if __name__ == "__main__":
    main()
