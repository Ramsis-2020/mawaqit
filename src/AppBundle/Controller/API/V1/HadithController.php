<?php

namespace AppBundle\Controller\API\V1;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Cache;

/**
 * @Route("/api/1.0.0/hadith", options={"i18n"="false"})
 */
class HadithController extends Controller
{

    /**
     * @Route("/random")
     * @Cache(public=true, maxage="7200", smaxage="7200", expires="+7200 sec")
     * @Method("GET")
     * @param Request $request
     * @return Response
     */
    public function randomAction(Request $request)
    {
        return $this->forward("AppBundle:API\V2\Hadith:random", [
            "request" => $request,
        ]);
    }

}
