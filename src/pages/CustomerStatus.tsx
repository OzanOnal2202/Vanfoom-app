import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, Clock, CheckCircle2, Wrench, FileSearch, MessageSquare, Info, Package } from "lucide-react";
import vanfoomLogo from '@/assets/vanfoom-logo.png';
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Database } from "@/integrations/supabase/types";

type WorkflowStatus = Database['public']['Enums']['bike_workflow_status'];

interface BikeData {
  id: string;
  frame_number: string;
  model: string;
  workflow_status: WorkflowStatus;
  table_number: string | null;
  created_at: string;
  updated_at: string;
}

const workflowSteps: WorkflowStatus[] = [
  "diagnose_nodig",
  "diagnose_bezig",
  "wacht_op_akkoord",
  "wacht_op_onderdelen",
  "klaar_voor_reparatie",
  "in_reparatie",
  "afgerond"
];

const CustomerStatus = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [frameNumber, setFrameNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [bike, setBike] = useState<BikeData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!frameNumber.trim()) {
      toast({
        title: t("error"),
        description: t("enterFrameNumber"),
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setNotFound(false);
    setBike(null);

    try {
      const { data, error } = await supabase
        .from("bikes")
        .select("id, frame_number, model, workflow_status, table_number, created_at, updated_at")
        .ilike("frame_number", frameNumber.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBike(data);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error searching bike:", error);
      toast({
        title: t("error"),
        description: t("searchError"),
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusIndex = (status: WorkflowStatus): number => {
    return workflowSteps.indexOf(status);
  };

  const getProgressPercentage = (status: WorkflowStatus): number => {
    const index = getStatusIndex(status);
    return ((index + 1) / workflowSteps.length) * 100;
  };

  const getStatusLabel = (status: WorkflowStatus): string => {
    const labels: Record<WorkflowStatus, string> = {
      diagnose_nodig: t("diagnoseNeeded"),
      diagnose_bezig: t("diagnosisInProgress"),
      wacht_op_akkoord: t("waitingForApproval"),
      wacht_op_onderdelen: t("waitingForParts"),
      klaar_voor_reparatie: t("readyForRepair"),
      in_reparatie: t("inRepair"),
      afgerond: t("completed"),
    };
    return labels[status];
  };

  const getStatusIcon = (status: WorkflowStatus) => {
    const icons: Record<WorkflowStatus, React.ReactNode> = {
      diagnose_nodig: <FileSearch className="h-5 w-5" />,
      diagnose_bezig: <FileSearch className="h-5 w-5" />,
      wacht_op_akkoord: <MessageSquare className="h-5 w-5" />,
      wacht_op_onderdelen: <Package className="h-5 w-5" />,
      klaar_voor_reparatie: <Clock className="h-5 w-5" />,
      in_reparatie: <Wrench className="h-5 w-5" />,
      afgerond: <CheckCircle2 className="h-5 w-5" />,
    };
    return icons[status];
  };

  const getStatusDescription = (status: WorkflowStatus): string => {
    const descriptions: Record<WorkflowStatus, string> = {
      diagnose_nodig: t("customerStatusDiagnose"),
      diagnose_bezig: t("customerStatusDiagnose"),
      wacht_op_akkoord: t("customerStatusWaiting"),
      wacht_op_onderdelen: t("customerStatusParts"),
      klaar_voor_reparatie: t("customerStatusReady"),
      in_reparatie: t("customerStatusInRepair"),
      afgerond: t("customerStatusCompleted"),
    };
    return descriptions[status];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={vanfoomLogo} alt="VanFoom" className="h-40 mix-blend-multiply" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t("customerStatusTitle")}</h1>
          <p className="text-muted-foreground">{t("customerStatusSubtitle")}</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">{t("searchYourBike")}</CardTitle>
            <CardDescription>{t("enterFrameNumberToSearch")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t("frameNumberPlaceholder")}
                value={frameNumber}
                onChange={(e) => setFrameNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? t("searching") : t("search")}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{t("findFrameNumberHint")}</p>
            </div>
          </CardContent>
        </Card>

        {notFound && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-destructive font-medium">{t("bikeNotFound")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("checkFrameNumber")}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {bike && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">VanMoof {bike.model}</CardTitle>
                    <CardDescription>{t("frameNumber")}: {bike.frame_number}</CardDescription>
                  </div>
                  <img src={vanfoomLogo} alt="VanFoom" className="h-12" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t("progress")}</span>
                      <span className="text-sm text-muted-foreground">
                        {getStatusIndex(bike.workflow_status) + 1} / {workflowSteps.length}
                      </span>
                    </div>
                    <Progress value={getProgressPercentage(bike.workflow_status)} className="h-3" />
                  </div>

                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-full text-primary">
                        {getStatusIcon(bike.workflow_status)}
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{t("currentStatus")}</p>
                        <p className="text-lg font-bold">{getStatusLabel(bike.workflow_status)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {getStatusDescription(bike.workflow_status)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t("repairSteps")}</p>
                    <div className="space-y-2">
                      {workflowSteps.map((step, index) => {
                        const currentIndex = getStatusIndex(bike.workflow_status);
                        const isCompleted = index < currentIndex;
                        const isCurrent = index === currentIndex;
                        const isPending = index > currentIndex;

                        return (
                          <div
                            key={step}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                              isCurrent
                                ? "bg-primary/10 border border-primary/30"
                                : isCompleted
                                ? "bg-green-500/10"
                                : "bg-muted/50"
                            }`}
                          >
                            <div
                              className={`p-1.5 rounded-full ${
                                isCurrent
                                  ? "bg-primary text-primary-foreground"
                                  : isCompleted
                                  ? "bg-green-500 text-white"
                                  : "bg-muted-foreground/20 text-muted-foreground"
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                getStatusIcon(step)
                              )}
                            </div>
                            <span
                              className={`text-sm ${
                                isCurrent
                                  ? "font-semibold text-primary"
                                  : isCompleted
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {getStatusLabel(step)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t text-sm text-muted-foreground">
                    <p>
                      {t("lastUpdated")}: {new Date(bike.updated_at).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerStatus;
